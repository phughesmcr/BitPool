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

// fromArray benchmarks
Deno.bench({
  name: "BitPool.fromArray - small array (1 word)",
  group: "fromArray",
  fn: () => {
    BitPool.fromArray([0b11110000], 32);
  },
});

Deno.bench({
  name: "BitPool.fromArray - medium array (4 words)",
  group: "fromArray",
  fn: () => {
    BitPool.fromArray([0b11110000, 0b00001111, 0b10101010, 0b01010101], 128);
  },
});

Deno.bench({
  name: "BitPool.fromArray - large array (32 words)",
  group: "fromArray",
  fn: () => {
    const arr = Array(32).fill(0b10101010);
    BitPool.fromArray(arr, 1024);
  },
});

Deno.bench({
  name: "BitPool.fromArray - sparse array (mostly zeros)",
  group: "fromArray",
  fn: () => {
    const arr = Array(16).fill(0);
    arr[0] = 0b00000001;
    arr[15] = 0b10000000;
    BitPool.fromArray(arr, 512);
  },
});

Deno.bench({
  name: "BitPool.fromArray - dense array (mostly ones)",
  group: "fromArray",
  fn: () => {
    const arr = Array(16).fill(0xFFFFFFFF);
    arr[0] = 0xFFFFFFFE;
    arr[15] = 0x7FFFFFFF;
    BitPool.fromArray(arr, 512);
  },
});

Deno.bench({
  name: "BitPool.fromArray - alternating pattern",
  group: "fromArray",
  fn: () => {
    const arr = Array(8).fill(0).map((_, i) => i % 2 === 0 ? 0xAAAAAAAA : 0x55555555);
    BitPool.fromArray(arr, 256);
  },
});

Deno.bench({
  name: "BitPool.fromArray - empty array with large capacity",
  group: "fromArray",
  fn: () => {
    BitPool.fromArray([], 1000);
  },
});

Deno.bench({
  name: "BitPool.fromArray - single bit set",
  group: "fromArray",
  fn: () => {
    BitPool.fromArray([1], 32);
  },
});

Deno.bench({
  name: "BitPool.fromArray - all bits set",
  group: "fromArray",
  fn: () => {
    const arr = Array(4).fill(0xFFFFFFFF);
    BitPool.fromArray(arr, 128);
  },
});

Deno.bench({
  name: "BitPool.fromArray - capacity much larger than array",
  group: "fromArray",
  fn: () => {
    BitPool.fromArray([0xAAAAAAAA], 1000);
  },
});

// refresh benchmarks
Deno.bench({
  name: "refresh - empty pool",
  group: "refresh",
  fn: () => {
    const pool = new BitPool(32);
    pool.refresh();
  },
});

Deno.bench({
  name: "refresh - fully occupied pool",
  group: "refresh",
  fn: () => {
    const pool = new BitPool(32);
    for (let i = 0; i < 32; i++) {
      pool.acquire();
    }
    pool.refresh();
  },
});

Deno.bench({
  name: "refresh - partially occupied pool",
  group: "refresh",
  fn: () => {
    const pool = new BitPool(32);
    for (let i = 0; i < 16; i++) {
      pool.acquire();
    }
    pool.refresh();
  },
});

Deno.bench({
  name: "refresh - with valid nextAvailableIndex",
  group: "refresh",
  fn: () => {
    const pool = new BitPool(32);
    // Acquire first bit to make index 0 unavailable
    pool.acquire();
    // Now index 0 is used, so we can safely use index 1
    pool.refresh(0);
  },
});

Deno.bench({
  name: "refresh - after sparse releases",
  group: "refresh",
  fn: () => {
    const pool = new BitPool(32);
    // Acquire all bits
    for (let i = 0; i < 32; i++) {
      pool.acquire();
    }
    // Release every third bit
    for (let i = 0; i < 32; i += 3) {
      pool.release(i);
    }
    pool.refresh();
  },
});

Deno.bench({
  name: "refresh - after sequential releases",
  group: "refresh",
  fn: () => {
    const pool = new BitPool(32);
    // Acquire first half
    for (let i = 0; i < 16; i++) {
      pool.acquire();
    }
    // Release first quarter
    for (let i = 0; i < 8; i++) {
      pool.release(i);
    }
    pool.refresh();
  },
});

Deno.bench({
  name: "refresh - across word boundaries",
  group: "refresh",
  fn: () => {
    const pool = new BitPool(64); // 2 words
    // Fill first word
    for (let i = 0; i < 32; i++) {
      pool.acquire();
    }
    // Release last bit of first word
    pool.release(31);
    pool.refresh();
  },
});

Deno.bench({
  name: "refresh - with suggested index in occupied region",
  group: "refresh",
  fn: () => {
    const pool = new BitPool(64);
    // Fill first half
    for (let i = 0; i < 32; i++) {
      pool.acquire();
    }
    // Try to refresh with index in first word (which has available bits)
    pool.refresh(0);
  },
});

Deno.bench({
  name: "refresh - after complex pattern",
  group: "refresh",
  fn: () => {
    const pool = new BitPool(64);
    // Create checkerboard pattern
    for (let i = 0; i < 64; i += 2) {
      pool.acquire();
    }
    pool.refresh();
  },
});

Deno.bench({
  name: "refresh - minimum size pool",
  group: "refresh",
  fn: () => {
    const pool = new BitPool(1);
    pool.acquire();
    pool.release(0);
    pool.refresh();
  },
});
