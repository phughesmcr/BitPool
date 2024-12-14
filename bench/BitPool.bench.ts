import { BitPool } from "../src/BitPool.ts";

// Constants for different pool sizes
const SMALL_POOL_SIZE = 32;
const MEDIUM_POOL_SIZE = 1024;
const LARGE_POOL_SIZE = 100000;

// Constructor benchmarks
Deno.bench({
  name: "BitPool constructor - small pool (32 bits)",
  group: "constructor",
  fn: () => {
    new BitPool(SMALL_POOL_SIZE);
  },
});

Deno.bench({
  name: "BitPool constructor - medium pool (1024 bits)",
  group: "constructor",
  fn: () => {
    new BitPool(MEDIUM_POOL_SIZE);
  },
});

Deno.bench({
  name: "BitPool constructor - large pool (100000 bits)",
  group: "constructor",
  fn: () => {
    new BitPool(LARGE_POOL_SIZE);
  },
});

// Acquire benchmarks
Deno.bench({
  name: "acquire() - best case (first bit)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire() - worst case (last bit)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Fill all but the last bit
    for (let i = 0; i < MEDIUM_POOL_SIZE - 1; i++) {
      pool.acquire();
    }
    // Acquire the last bit
    pool.acquire();
  },
});

Deno.bench({
  name: "acquire() - random pattern (50% full)",
  group: "acquire",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Fill half the pool
    for (let i = 0; i < MEDIUM_POOL_SIZE / 2; i++) {
      pool.acquire();
    }
    // Acquire one more bit
    pool.acquire();
  },
});

// Release benchmarks
Deno.bench({
  name: "release() - single bit",
  group: "release",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const bit = pool.acquire();
    pool.release(bit);
  },
});

Deno.bench({
  name: "release() - multiple bits",
  group: "release",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const bits: number[] = [];
    // Acquire 10 bits
    for (let i = 0; i < 10; i++) {
      bits.push(pool.acquire());
    }
    // Release all bits
    for (const bit of bits) {
      pool.release(bit);
    }
  },
});

// isOccupied benchmarks
Deno.bench({
  name: "isOccupied() - first bit",
  group: "isOccupied",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.isOccupied(0);
  },
});

Deno.bench({
  name: "isOccupied() - last bit",
  group: "isOccupied",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.isOccupied(MEDIUM_POOL_SIZE - 1);
  },
});

Deno.bench({
  name: "isOccupied() - mixed state",
  group: "isOccupied",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Acquire some bits
    pool.acquire();
    pool.acquire();
    pool.acquire();
    // Check middle bit
    pool.isOccupied(MEDIUM_POOL_SIZE / 2);
  },
});

// Combined operations benchmark
Deno.bench({
  name: "Mixed operations - acquire/release/isOccupied",
  group: "combined",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const bit1 = pool.acquire();
    const bit2 = pool.acquire();
    pool.isOccupied(bit1);
    pool.release(bit1);
    pool.isOccupied(bit2);
    pool.acquire();
  },
});

// Edge case benchmarks
Deno.bench({
  name: "Edge case - acquire when pool is full",
  group: "edge-cases",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    // Fill the pool completely
    for (let i = 0; i < SMALL_POOL_SIZE; i++) {
      pool.acquire();
    }
    // Try to acquire when full
    pool.acquire();
  },
});

Deno.bench({
  name: "Edge case - release at boundary positions",
  group: "edge-cases",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    // Acquire bits at word boundaries
    const bit0 = pool.acquire(); // First bit
    const bit31 = 31; // Last bit of first word
    const bit32 = 32; // First bit of second word
    pool.release(bit0);
    pool.release(bit31);
    pool.release(bit32);
  },
});

Deno.bench({
  name: "Edge case - rapid acquire/release cycles",
  group: "edge-cases",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    for (let i = 0; i < 10; i++) {
      const bit = pool.acquire();
      pool.release(bit);
    }
  },
});

Deno.bench({
  name: "Edge case - fragmented pool operations",
  group: "edge-cases",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const bits: number[] = [];
    // Create fragmentation by acquiring every other bit
    for (let i = 0; i < 20; i += 2) {
      bits.push(pool.acquire());
    }
    // Release every other acquired bit
    for (let i = 0; i < bits.length; i += 2) {
      pool.release(bits[i]!);
    }
    // Try to acquire in fragmented state
    pool.acquire();
  },
});

Deno.bench({
  name: "Edge case - minimum size pool operations",
  group: "edge-cases",
  fn: () => {
    const pool = new BitPool(1);
    pool.acquire();
    pool.release(0);
    pool.acquire();
  },
});

Deno.bench({
  name: "Edge case - word boundary operations",
  group: "edge-cases",
  fn: () => {
    const pool = new BitPool(64); // 2 words
    // Fill first word
    for (let i = 0; i < 32; i++) {
      pool.acquire();
    }
    // Check and operate across boundary
    pool.isOccupied(31); // Last bit of first word
    pool.isOccupied(32); // First bit of second word
    pool.acquire();
  },
});

Deno.bench({
  name: "Edge case - release invalid positions",
  group: "edge-cases",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    // Try to release invalid positions
    pool.release(-1);
    pool.release(SMALL_POOL_SIZE);
    pool.release(SMALL_POOL_SIZE + 1);
  },
});
