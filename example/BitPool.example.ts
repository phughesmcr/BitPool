import { BitPool } from "../mod.ts";

const CAPACITY: number = 65_536; // Ports 0..65535
const RESERVED_UNTIL: number = 49_152; // Ephemeral ports start at 49152
const EPHEMERAL_COUNT: number = CAPACITY - RESERVED_UNTIL;

function buildAvailabilityMask(capacity: number, reservedUntil: number): Uint32Array {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new RangeError("Invalid capacity");
  }
  if (!Number.isSafeInteger(reservedUntil) || reservedUntil < 0 || reservedUntil > capacity) {
    throw new RangeError("Invalid reservedUntil");
  }

  const chunkCount: number = Math.ceil(capacity / 32);
  const mask = new Uint32Array(chunkCount);

  // Set bits [reservedUntil, capacity) to 1 (available), others 0 (occupied)
  for (let i = reservedUntil; i < capacity; i++) {
    const chunkIndex: number = i >>> 5; // i / 32
    const bitPosition: number = i & 31; // i % 32
    mask[chunkIndex] |= (1 << bitPosition);
  }
  return mask;
}

const initialMask: Uint32Array = buildAvailabilityMask(CAPACITY, RESERVED_UNTIL);
const pool: BitPool = BitPool.fromUint32Array(CAPACITY, initialMask);

// Acquire all ephemeral "ports"
const acquired: number[] = [];
const t0: number = performance.now();
for (let i = 0; i < EPHEMERAL_COUNT; i++) {
  const port: number = pool.acquire();
  if (port === -1) break;
  acquired.push(port);
}
const t1: number = performance.now();

// Release them back (reverse order to vary search path)
const t2: number = performance.now();
for (let i = acquired.length - 1; i >= 0; i--) {
  pool.release(acquired[i]!);
}
const t3: number = performance.now();

// Report
const acquireThroughput: number = Math.round(acquired.length / ((t1 - t0) / 1000));
const releaseThroughput: number = Math.round(acquired.length / ((t3 - t2) / 1000));

console.log(`Ephemeral ports available: ${pool.availableCount} (expected ${EPHEMERAL_COUNT})`);
console.log(`Acquired ${acquired.length} ports in ${(t1 - t0).toFixed(2)}ms (~${acquireThroughput} ops/sec)`);
console.log(`Released ${acquired.length} ports in ${(t3 - t2).toFixed(2)}ms (~${releaseThroughput} ops/sec)`);

// Show a sample of first available ephemeral ports after release
const sample: number[] = [];
for (const idx of pool.availableIndices(RESERVED_UNTIL, CAPACITY)) {
  sample.push(idx);
  if (sample.length >= 8) break;
}
console.log("First available ephemeral ports:", sample);


