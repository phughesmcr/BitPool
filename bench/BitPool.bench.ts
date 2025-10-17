/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { BitPool } from "../src/BitPool.ts";

// Pool sizes
const SMALL_POOL_SIZE = 32;
const MEDIUM_POOL_SIZE = 1024;
const LARGE_POOL_SIZE = 100000;

// ============================================================================
// Helper Utilities
// ============================================================================

/**
 * Simple deterministic PRNG for reproducible benchmarks.
 * LCG algorithm: x_n+1 = (a * x_n + c) mod m
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

function prefill(pool: BitPool, count: number): void {
  for (let i = 0; i < count; i++) {
    pool.acquire();
  }
}

function prefillFraction(pool: BitPool, fraction: number): void {
  const count = Math.floor(pool.size * fraction);
  prefill(pool, count);
}

// ============================================================================
// Constructor Benchmarks
// ============================================================================

Deno.bench({
  name: "constructor - small (32)",
  group: "constructor",
  fn: () => {
    new BitPool(SMALL_POOL_SIZE);
  },
});

Deno.bench({
  name: "constructor - medium (1024)",
  group: "constructor",
  fn: () => {
    new BitPool(MEDIUM_POOL_SIZE);
  },
});

Deno.bench({
  name: "constructor - large (100000)",
  group: "constructor",
  fn: () => {
    new BitPool(LARGE_POOL_SIZE);
  },
});

// ============================================================================
// fromUint32Array Benchmarks
// ============================================================================

Deno.bench({
  name: "fromUint32Array - empty array (32)",
  group: "from-uint32array",
  fn: () => {
    BitPool.fromUint32Array(SMALL_POOL_SIZE, []);
  },
});

Deno.bench({
  name: "fromUint32Array - empty array (1024)",
  group: "from-uint32array",
  fn: () => {
    BitPool.fromUint32Array(MEDIUM_POOL_SIZE, []);
  },
});

Deno.bench({
  name: "fromUint32Array - 0% occupied (1024)",
  group: "from-uint32array",
  fn: () => {
    const words = Math.ceil(MEDIUM_POOL_SIZE / 32);
    const arr = Array(words).fill(0);
    BitPool.fromUint32Array(MEDIUM_POOL_SIZE, arr);
  },
});

Deno.bench({
  name: "fromUint32Array - 50% alternating (1024)",
  group: "from-uint32array",
  fn: () => {
    const words = Math.ceil(MEDIUM_POOL_SIZE / 32);
    const arr = Array(words).fill(0xAAAAAAAA);
    BitPool.fromUint32Array(MEDIUM_POOL_SIZE, arr);
  },
});

Deno.bench({
  name: "fromUint32Array - 100% occupied (1024)",
  group: "from-uint32array",
  fn: () => {
    const words = Math.ceil(MEDIUM_POOL_SIZE / 32);
    const arr = Array(words).fill(0xFFFFFFFF);
    BitPool.fromUint32Array(MEDIUM_POOL_SIZE, arr);
  },
});

Deno.bench({
  name: "fromUint32Array - 0% occupied (100000)",
  group: "from-uint32array",
  fn: () => {
    const words = Math.ceil(LARGE_POOL_SIZE / 32);
    const arr = Array(words).fill(0);
    BitPool.fromUint32Array(LARGE_POOL_SIZE, arr);
  },
});

Deno.bench({
  name: "fromUint32Array - 50% alternating (100000)",
  group: "from-uint32array",
  fn: () => {
    const words = Math.ceil(LARGE_POOL_SIZE / 32);
    const arr = Array(words).fill(0xAAAAAAAA);
    BitPool.fromUint32Array(LARGE_POOL_SIZE, arr);
  },
});

Deno.bench({
  name: "fromUint32Array - 100% occupied (100000)",
  group: "from-uint32array",
  fn: () => {
    const words = Math.ceil(LARGE_POOL_SIZE / 32);
    const arr = Array(words).fill(0xFFFFFFFF);
    BitPool.fromUint32Array(LARGE_POOL_SIZE, arr);
  },
});

// ============================================================================
// fromArray Benchmarks
// ============================================================================

Deno.bench({
  name: "fromArray - empty array (32)",
  group: "from-array",
  fn: () => {
    BitPool.fromArray(SMALL_POOL_SIZE, []);
  },
});

Deno.bench({
  name: "fromArray - 0% occupied (1024)",
  group: "from-array",
  fn: () => {
    const words = Math.ceil(MEDIUM_POOL_SIZE / 32);
    const arr = Array(words).fill(0);
    BitPool.fromArray(MEDIUM_POOL_SIZE, arr);
  },
});

Deno.bench({
  name: "fromArray - 50% alternating (1024)",
  group: "from-array",
  fn: () => {
    const words = Math.ceil(MEDIUM_POOL_SIZE / 32);
    const arr = Array(words).fill(0xAAAAAAAA);
    BitPool.fromArray(MEDIUM_POOL_SIZE, arr);
  },
});

Deno.bench({
  name: "fromArray - 100% occupied (1024)",
  group: "from-array",
  fn: () => {
    const words = Math.ceil(MEDIUM_POOL_SIZE / 32);
    const arr = Array(words).fill(0xFFFFFFFF);
    BitPool.fromArray(MEDIUM_POOL_SIZE, arr);
  },
});

Deno.bench({
  name: "fromArray - 50% alternating (100000)",
  group: "from-array",
  fn: () => {
    const words = Math.ceil(LARGE_POOL_SIZE / 32);
    const arr = Array(words).fill(0xAAAAAAAA);
    BitPool.fromArray(LARGE_POOL_SIZE, arr);
  },
});

// ============================================================================
// Acquire Benchmarks
// ============================================================================

Deno.bench({
  name: "acquire - empty pool (32)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - empty pool (1024)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - empty pool (100000)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - 50% prefilled (32)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - 50% prefilled (1024)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - 50% prefilled (100000)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - 95% prefilled (32)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    prefillFraction(pool, 0.95);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - 95% prefilled (1024)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.95);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - 95% prefilled (100000)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    prefillFraction(pool, 0.95);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - 99% prefilled (1024)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.99);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - 99% prefilled (100000)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    prefillFraction(pool, 0.99);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire - full pool (returns -1)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    prefillFraction(pool, 1.0);
    pool.acquire();
  },
});

// ============================================================================
// Release Benchmarks
// ============================================================================

Deno.bench({
  name: "release - typical index",
  group: "release",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const bit = pool.acquire();
    pool.release(bit);
  },
});

Deno.bench({
  name: "release - boundary index 0",
  group: "release",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.acquire();
    pool.release(0);
  },
});

Deno.bench({
  name: "release - boundary index 31",
  group: "release",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefill(pool, 32);
    pool.release(31);
  },
});

Deno.bench({
  name: "release - boundary index 32",
  group: "release",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefill(pool, 33);
    pool.release(32);
  },
});

Deno.bench({
  name: "release - last index",
  group: "release",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 1.0);
    pool.release(MEDIUM_POOL_SIZE - 1);
  },
});

// ============================================================================
// Query Benchmarks (isOccupied, isAvailable, findNextAvailable)
// ============================================================================

Deno.bench({
  name: "isOccupied - first index",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.isOccupied(0);
  },
});

Deno.bench({
  name: "isOccupied - middle index",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.isOccupied(Math.floor(MEDIUM_POOL_SIZE / 2));
  },
});

Deno.bench({
  name: "isOccupied - last index",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.isOccupied(MEDIUM_POOL_SIZE - 1);
  },
});

Deno.bench({
  name: "isAvailable - first index",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.isAvailable(0);
  },
});

Deno.bench({
  name: "isAvailable - middle index",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.isAvailable(Math.floor(MEDIUM_POOL_SIZE / 2));
  },
});

Deno.bench({
  name: "isAvailable - last index",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.isAvailable(MEDIUM_POOL_SIZE - 1);
  },
});

Deno.bench({
  name: "findNextAvailable - empty pool",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.findNextAvailable();
  },
});

Deno.bench({
  name: "findNextAvailable - 50% prefilled",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.findNextAvailable();
  },
});

Deno.bench({
  name: "findNextAvailable - 95% prefilled",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.95);
    pool.findNextAvailable();
  },
});

Deno.bench({
  name: "findNextAvailable - 99% prefilled",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.99);
    pool.findNextAvailable();
  },
});

Deno.bench({
  name: "findNextAvailable - with loop=false",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.findNextAvailable(100, false);
  },
});

Deno.bench({
  name: "findNextAvailable - with loop=true",
  group: "queries",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.findNextAvailable(100, true);
  },
});

// ============================================================================
// Bulk Operations (fill, clear, refresh, clone)
// ============================================================================

Deno.bench({
  name: "fill - 1024",
  group: "bulk",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.fill();
  },
});

Deno.bench({
  name: "fill - 100000",
  group: "bulk",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    pool.fill();
  },
});

Deno.bench({
  name: "clear - 1024",
  group: "bulk",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.clear();
  },
});

Deno.bench({
  name: "clear - 100000",
  group: "bulk",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    pool.clear();
  },
});

Deno.bench({
  name: "refresh - empty pool",
  group: "bulk",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.refresh();
  },
});

Deno.bench({
  name: "refresh - full pool",
  group: "bulk",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 1.0);
    pool.refresh();
  },
});

Deno.bench({
  name: "refresh - 50% prefilled",
  group: "bulk",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.refresh();
  },
});

Deno.bench({
  name: "refresh - fragmented (every 3rd free)",
  group: "bulk",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 1.0);
    for (let i = 0; i < MEDIUM_POOL_SIZE; i += 3) {
      pool.release(i);
    }
    pool.refresh();
  },
});

Deno.bench({
  name: "clone - 1024",
  group: "bulk",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.clone();
  },
});

Deno.bench({
  name: "clone - 100000",
  group: "bulk",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.clone();
  },
});

// ============================================================================
// Iteration Benchmarks
// ============================================================================

Deno.bench({
  name: "availableIndices - 0% occupied (1024)",
  group: "iteration",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    let sum = 0;
    for (const idx of pool.availableIndices()) {
      sum += idx;
    }
  },
});

Deno.bench({
  name: "availableIndices - 50% occupied (1024)",
  group: "iteration",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    let sum = 0;
    for (const idx of pool.availableIndices()) {
      sum += idx;
    }
  },
});

Deno.bench({
  name: "availableIndices - 95% occupied (1024)",
  group: "iteration",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.95);
    let sum = 0;
    for (const idx of pool.availableIndices()) {
      sum += idx;
    }
  },
});

Deno.bench({
  name: "occupiedIndices - 50% occupied (1024)",
  group: "iteration",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    let sum = 0;
    for (const idx of pool.occupiedIndices()) {
      sum += idx;
    }
  },
});

Deno.bench({
  name: "occupiedIndices - 95% occupied (1024)",
  group: "iteration",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.95);
    let sum = 0;
    for (const idx of pool.occupiedIndices()) {
      sum += idx;
    }
  },
});

Deno.bench({
  name: "occupiedIndices - 100% occupied (1024)",
  group: "iteration",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 1.0);
    let sum = 0;
    for (const idx of pool.occupiedIndices()) {
      sum += idx;
    }
  },
});

Deno.bench({
  name: "Symbol.iterator - 1024",
  group: "iteration",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    let sum = 0;
    for (const word of pool) {
      sum += word;
    }
  },
});

Deno.bench({
  name: "Symbol.iterator - 100000",
  group: "iteration",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    prefillFraction(pool, 0.5);
    let sum = 0;
    for (const word of pool) {
      sum += word;
    }
  },
});

// ============================================================================
// Mixed Operations (realistic patterns)
// ============================================================================

Deno.bench({
  name: "mixed - random ops (70% acquire, 30% release)",
  group: "mixed",
  fn: () => {
    const pool = new BitPool(10000);
    const rng = new SeededRandom(42);
    const acquired: number[] = [];

    for (let i = 0; i < 500; i++) {
      if (rng.next() < 0.7 || acquired.length === 0) {
        const bit = pool.acquire();
        if (bit !== -1) {
          acquired.push(bit);
        }
      } else {
        const idx = rng.nextInt(acquired.length);
        const bit = acquired[idx]!;
        pool.release(bit);
        acquired.splice(idx, 1);
      }
    }
  },
});

Deno.bench({
  name: "mixed - fragmentation pattern",
  group: "mixed",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const acquired: number[] = [];

    // Acquire many bits
    for (let i = 0; i < 800; i++) {
      acquired.push(pool.acquire());
    }

    // Release every 5th bit to create fragmentation
    for (let i = 0; i < acquired.length; i += 5) {
      pool.release(acquired[i]!);
    }

    // Measure acquisition in fragmented state
    for (let i = 0; i < 100; i++) {
      pool.acquire();
    }
  },
});

// ============================================================================
// Error Handling
// ============================================================================

Deno.bench({
  name: "errors - isOccupied out of bounds",
  group: "errors",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    try {
      pool.isOccupied(SMALL_POOL_SIZE);
    } catch {
      // Expected error
    }
  },
});

Deno.bench({
  name: "errors - isAvailable out of bounds",
  group: "errors",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    try {
      pool.isAvailable(-1);
    } catch {
      // Expected error
    }
  },
});

Deno.bench({
  name: "errors - release invalid indices (no throw)",
  group: "errors",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    pool.release(-1);
    pool.release(SMALL_POOL_SIZE);
    pool.release(SMALL_POOL_SIZE + 100);
  },
});

// ============================================================================
// Property Getters
// ============================================================================

Deno.bench({
  name: "props - size (32)",
  group: "props",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    pool.size;
  },
});

Deno.bench({
  name: "props - size (1024)",
  group: "props",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.size;
  },
});

Deno.bench({
  name: "props - availableCount",
  group: "props",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.availableCount;
  },
});

Deno.bench({
  name: "props - occupiedCount",
  group: "props",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.occupiedCount;
  },
});

Deno.bench({
  name: "props - isEmpty",
  group: "props",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.isEmpty;
  },
});

Deno.bench({
  name: "props - isFull",
  group: "props",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 1.0);
    pool.isFull;
  },
});

Deno.bench({
  name: "props - nextAvailableIndex (empty)",
  group: "props",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.nextAvailableIndex;
  },
});

Deno.bench({
  name: "props - nextAvailableIndex (50% filled)",
  group: "props",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    prefillFraction(pool, 0.5);
    pool.nextAvailableIndex;
  },
});
