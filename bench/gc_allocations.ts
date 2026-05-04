/// <reference lib="deno.ns" />
/// <reference lib="dom" />
// deno-lint-ignore-file no-console

import { BitPool } from "../mod.ts";

type GcFn = () => void;

type Scenario = {
  name: string;
  iterations: number;
  fn: () => void;
  rounds?: number;
  warmupIterations?: number;
  maxSteadyStateBeforeGcBytesPerIter?: number;
};

type MemorySnapshot = ReturnType<typeof Deno.memoryUsage>;
type RoundMeasurement = {
  beforeGc: MemorySnapshot;
  retainedAfterGc: MemorySnapshot;
};
type ScenarioSummary = {
  scenario: Scenario;
  lowestBeforeGc: MemorySnapshot;
  lowestRetainedAfterGc: MemorySnapshot;
  highestSteadyStateBeforeGc: MemorySnapshot;
};

const DEFAULT_ROUNDS = 3;
const DEFAULT_WARMUP_ITERATIONS = 10_000;
const ZERO_ALLOC_BUDGET_BYTES_PER_ITER = 0.5;
const checkMode = Deno.args.includes("--check");

const gc = (globalThis as { gc?: GcFn }).gc;

if (typeof gc !== "function") {
  throw new Error("Run with: deno run --v8-flags=--expose-gc bench/gc_allocations.ts");
}

const forceGc: GcFn = gc;

function collect(): void {
  for (let i = 0; i < 3; i++) {
    forceGc();
  }
}

function formatBytes(bytes: number): string {
  const sign = bytes < 0 ? "-" : "";
  const abs = Math.abs(bytes);
  if (abs >= 1024 * 1024) return `${sign}${(abs / (1024 * 1024)).toFixed(2)} MiB`;
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(2)} KiB`;
  return `${sign}${abs} B`;
}

function diff(after: MemorySnapshot, before: MemorySnapshot): MemorySnapshot {
  return {
    rss: after.rss - before.rss,
    heapTotal: after.heapTotal - before.heapTotal,
    heapUsed: after.heapUsed - before.heapUsed,
    external: after.external - before.external,
  };
}

function totalBytes(delta: MemorySnapshot): number {
  return delta.heapUsed + delta.external;
}

function bytesPerIteration(delta: MemorySnapshot, iterations: number): number {
  return totalBytes(delta) / iterations;
}

function printRow(label: string, delta: MemorySnapshot, iterations: number): void {
  const bytesPerIter = bytesPerIteration(delta, iterations);
  console.log(
    [
      label.padEnd(42),
      `heap=${formatBytes(delta.heapUsed)}`.padStart(18),
      `external=${formatBytes(delta.external)}`.padStart(22),
      `rss=${formatBytes(delta.rss)}`.padStart(18),
      `approx/iter=${formatBytes(bytesPerIter)}`.padStart(24),
    ].join("  "),
  );
}

function measureRound(scenario: Scenario): RoundMeasurement {
  collect();
  const before = Deno.memoryUsage();

  for (let i = 0; i < scenario.iterations; i++) {
    scenario.fn();
  }

  const beforeCollection = Deno.memoryUsage();
  collect();
  const afterCollection = Deno.memoryUsage();

  return {
    beforeGc: diff(beforeCollection, before),
    retainedAfterGc: diff(afterCollection, before),
  };
}

function warmupScenario(scenario: Scenario): void {
  const iterations = Math.min(scenario.iterations, scenario.warmupIterations ?? DEFAULT_WARMUP_ITERATIONS);
  for (let i = 0; i < iterations; i++) {
    scenario.fn();
  }
  collect();
}

function selectLowestAllocRound(rounds: RoundMeasurement[], key: keyof RoundMeasurement): MemorySnapshot {
  let best = rounds[0]![key];
  for (let i = 1; i < rounds.length; i++) {
    const candidate = rounds[i]![key];
    if (totalBytes(candidate) < totalBytes(best)) {
      best = candidate;
    }
  }
  return best;
}

function selectHighestAllocRound(
  rounds: RoundMeasurement[],
  key: keyof RoundMeasurement,
  startRound: number,
): MemorySnapshot {
  let worst = rounds[startRound]![key];
  for (let i = startRound + 1; i < rounds.length; i++) {
    const candidate = rounds[i]![key];
    if (totalBytes(candidate) > totalBytes(worst)) {
      worst = candidate;
    }
  }
  return worst;
}

function runScenario(scenario: Scenario): ScenarioSummary {
  const roundCount = scenario.rounds ?? DEFAULT_ROUNDS;
  const rounds = new Array<RoundMeasurement>(roundCount);

  console.log(`\n${scenario.name} (${scenario.iterations.toLocaleString()} iterations)`);
  warmupScenario(scenario);
  for (let round = 0; round < roundCount; round++) {
    const measurement = measureRound(scenario);
    rounds[round] = measurement;
    printRow(`round ${round + 1} before GC`, measurement.beforeGc, scenario.iterations);
    printRow(`round ${round + 1} retained after GC`, measurement.retainedAfterGc, scenario.iterations);
  }

  const lowestBeforeGc = selectLowestAllocRound(rounds, "beforeGc");
  const lowestRetainedAfterGc = selectLowestAllocRound(rounds, "retainedAfterGc");
  const steadyStateStartRound = roundCount > 1 ? 1 : 0;
  const highestSteadyStateBeforeGc = selectHighestAllocRound(rounds, "beforeGc", steadyStateStartRound);
  printRow("lowest before GC", lowestBeforeGc, scenario.iterations);
  printRow("lowest retained after GC", lowestRetainedAfterGc, scenario.iterations);
  if (roundCount > 1) {
    printRow("highest steady-state before GC", highestSteadyStateBeforeGc, scenario.iterations);
  }

  return {
    scenario,
    lowestBeforeGc,
    lowestRetainedAfterGc,
    highestSteadyStateBeforeGc,
  };
}

function checkBudgets(summaries: ScenarioSummary[]): boolean {
  let passed = true;
  console.log("\nAllocation budget check");

  for (const summary of summaries) {
    const budget = summary.scenario.maxSteadyStateBeforeGcBytesPerIter;
    if (budget === undefined) continue;

    const actual = bytesPerIteration(summary.highestSteadyStateBeforeGc, summary.scenario.iterations);
    const ok = actual <= budget;
    passed &&= ok;
    const status = ok ? "PASS" : "FAIL";
    console.log(
      `${status} ${summary.scenario.name}: highest steady-state before-GC ${
        actual.toFixed(4)
      } B/iter <= ${budget} B/iter`,
    );
  }

  return passed;
}

function prefill(pool: BitPool, count: number): void {
  for (let i = 0; i < count; i++) {
    pool.acquire();
  }
}

function budgeted(name: string, iterations: number, fn: () => void): Scenario {
  return {
    name,
    iterations,
    maxSteadyStateBeforeGcBytesPerIter: ZERO_ALLOC_BUDGET_BYTES_PER_ITER,
    fn,
  };
}

const medium = new BitPool(10_000);
const sparse = new BitPool(10_000);
const dense = new BitPool(10_000);
const fragmented = new BitPool(10_000);
const other = new BitPool(10_000);
const out = new BitPool(10_000);
const acquireOut = new Uint32Array(256);
const indexOut = new Uint32Array(10_000);
const releaseArray = new Array<number>(256);
const releaseTyped = new Uint32Array(256);
const rawWords = new Uint32Array(Math.ceil(10_000 / 32));
const noopIndex = (_index: number): void => {};
const noopChunk = (_chunk: number, _chunkIndex: number): void => {};
let querySink = 0;
let iterationSink = 0;
let chunkSink = 0;
let frameSink = 0;

prefill(sparse, 100);
prefill(dense, dense.size);
prefill(fragmented, fragmented.size);
for (let i = 0; i < fragmented.size; i += 4) {
  fragmented.release(i);
}
prefill(other, 5_000);
for (let i = 0; i < acquireOut.length; i++) {
  releaseArray[i] = i;
  releaseTyped[i] = i;
}
rawWords.fill(0xAAAAAAAA);

const scenarios: Scenario[] = [
  {
    name: "constructor allocating",
    iterations: 50_000,
    fn: () => {
      new BitPool(10_000);
    },
  },
  {
    name: "fromUint32Array allocating",
    iterations: 50_000,
    fn: () => {
      BitPool.fromUint32Array(rawWords.length * 32, rawWords);
    },
  },
  {
    name: "clone allocating",
    iterations: 50_000,
    fn: () => {
      medium.clone();
    },
  },
  {
    name: "toUint32Array allocating",
    iterations: 50_000,
    fn: () => {
      medium.toUint32Array();
    },
  },
  budgeted("single acquire/release hot path", 250_000, () => {
    const index = medium.acquire();
    medium.release(index);
  }),
  budgeted("acquire from fragmented pool", 250_000, () => {
    const index = fragmented.acquire();
    fragmented.release(index);
  }),
  budgeted("release invalid indices", 250_000, () => {
    medium.release(-1);
    medium.release(10_000);
    medium.release(1.5);
  }),
  budgeted("acquireNInto with releaseMany number[]", 100_000, () => {
    const count = medium.acquireNInto(acquireOut);
    medium.releaseMany(releaseArray, count);
  }),
  budgeted("releaseMany Uint32Array preallocated", 100_000, () => {
    prefill(medium, releaseTyped.length);
    medium.releaseMany(releaseTyped);
  }),
  {
    name: "acquireN allocating",
    iterations: 50_000,
    fn: () => {
      const acquired = medium.acquireN(8);
      medium.releaseAll(acquired);
    },
  },
  {
    name: "availableIndices generator",
    iterations: 50_000,
    fn: () => {
      const iterator = sparse.availableIndices();
      const result = iterator.next();
      iterationSink ^= result.value ?? 0;
      iterationSink ^= result.done ? 1 : 0;
    },
  },
  {
    name: "occupiedIndices generator",
    iterations: 50_000,
    fn: () => {
      const iterator = sparse.occupiedIndices();
      const result = iterator.next();
      iterationSink ^= result.value ?? 0;
      iterationSink ^= result.done ? 1 : 0;
    },
  },
  {
    name: "chunk iterator",
    iterations: 50_000,
    fn: () => {
      const iterator = sparse[Symbol.iterator]();
      const result = iterator.next();
      chunkSink ^= result.value ?? 0;
      chunkSink ^= result.done ? 1 : 0;
    },
  },
  budgeted("forEachAvailable zero-allocation iteration", 100_000, () => {
    sparse.forEachAvailable(noopIndex);
  }),
  budgeted("forEachOccupied zero-allocation iteration", 100_000, () => {
    sparse.forEachOccupied(noopIndex);
  }),
  budgeted("forEachChunk zero-allocation iteration", 100_000, () => {
    sparse.forEachChunk(noopChunk);
  }),
  budgeted("availableIndicesInto preallocated", 100_000, () => {
    iterationSink ^= sparse.availableIndicesInto(indexOut);
  }),
  budgeted("occupiedIndicesInto preallocated", 100_000, () => {
    iterationSink ^= dense.occupiedIndicesInto(indexOut);
  }),
  budgeted("single-bit queries", 250_000, () => {
    querySink ^= medium.isOccupied(17) ? 1 : 0;
    querySink ^= medium.isAvailable(17) ? 1 : 0;
    querySink ^= medium.nextAvailableIndex;
    querySink ^= medium.availableCount;
    querySink ^= medium.occupiedCount;
  }),
  budgeted("findNextAvailable queries", 250_000, () => {
    querySink ^= fragmented.findNextAvailable(0, false);
    querySink ^= fragmented.findNextAvailable(9_000, true);
  }),
  budgeted("fill clear refresh", 100_000, () => {
    out.fill();
    out.clear();
    out.refresh();
  }),
  budgeted("binary set operations into preallocated", 100_000, () => {
    sparse.intersectInto(other, out);
    sparse.unionInto(other, out);
    sparse.differenceInto(other, out);
    sparse.symmetricDifferenceInto(other, out);
  }),
  budgeted("game frame scratch-buffer reuse", 100_000, () => {
    const count = medium.acquireNInto(acquireOut);
    sparse.unionInto(other, out);
    frameSink ^= out.availableIndicesInto(indexOut);
    for (let i = 0; i < count; i++) {
      medium.release(acquireOut[i]!);
    }
  }),
];

console.log("BitPool GC allocation pressure benchmark");
console.log("Measures memory growth during tight loops, forcing GC between each round.");

const summaries: ScenarioSummary[] = [];
for (const scenario of scenarios) {
  summaries.push(runScenario(scenario));
}

if (checkMode && !checkBudgets(summaries)) {
  Deno.exit(1);
}

if (querySink === Number.MIN_SAFE_INTEGER) {
  console.log("unreachable", querySink);
}
if (iterationSink === Number.MIN_SAFE_INTEGER) {
  console.log("unreachable", iterationSink);
}
if (chunkSink === Number.MIN_SAFE_INTEGER) {
  console.log("unreachable", chunkSink);
}
if (frameSink === Number.MIN_SAFE_INTEGER) {
  console.log("unreachable", frameSink);
}
