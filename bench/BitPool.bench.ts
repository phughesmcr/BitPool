/// <reference lib="deno.ns" />
/// <reference lib="dom" />

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

// findFirstSetBit benchmarks
Deno.bench({
  name: "findFirstSetBit() - first bit set",
  group: "findFirstSetBit",
  fn: () => {
    BitPool.findFirstSetBit(0b00000001);
  },
});

Deno.bench({
  name: "findFirstSetBit() - last bit set",
  group: "findFirstSetBit",
  fn: () => {
    BitPool.findFirstSetBit(0b10000000000000000000000000000000);
  },
});

Deno.bench({
  name: "findFirstSetBit() - middle bit set",
  group: "findFirstSetBit",
  fn: () => {
    BitPool.findFirstSetBit(0b00000000000000010000000000000000);
  },
});

Deno.bench({
  name: "findFirstSetBit() - multiple bits set",
  group: "findFirstSetBit",
  fn: () => {
    BitPool.findFirstSetBit(0b10101010101010101010101010101010);
  },
});

Deno.bench({
  name: "findFirstSetBit() - zero value",
  group: "findFirstSetBit",
  fn: () => {
    BitPool.findFirstSetBit(0);
  },
});

Deno.bench({
  name: "findFirstSetBit() - all bits set",
  group: "findFirstSetBit",
  fn: () => {
    BitPool.findFirstSetBit(0xFFFFFFFF);
  },
});

// getHierarchyWord benchmarks
Deno.bench({
  name: "getHierarchyWord() - first hierarchy word",
  group: "getHierarchyWord",
  fn: () => {
    const pool = new BitPool(1024);
    pool.getHierarchyWord(0);
  },
});

Deno.bench({
  name: "getHierarchyWord() - last hierarchy word",
  group: "getHierarchyWord",
  fn: () => {
    const pool = new BitPool(1024);
    pool.getHierarchyWord(0); // 1024 bits = 32 words = 1 hierarchy word
  },
});

Deno.bench({
  name: "getHierarchyWord() - out of bounds index",
  group: "getHierarchyWord",
  fn: () => {
    const pool = new BitPool(32);
    pool.getHierarchyWord(10);
  },
});

Deno.bench({
  name: "getHierarchyWord() - after modifications",
  group: "getHierarchyWord",
  fn: () => {
    const pool = new BitPool(64);
    pool.acquire();
    pool.acquire();
    pool.getHierarchyWord(0);
  },
});

// Property getter benchmarks
Deno.bench({
  name: "size getter - small pool",
  group: "property-getters",
  fn: () => {
    const pool = new BitPool(32);
    pool.size;
  },
});

Deno.bench({
  name: "size getter - large pool",
  group: "property-getters",
  fn: () => {
    const pool = new BitPool(100000);
    pool.size;
  },
});

Deno.bench({
  name: "nextAvailableIndex getter - empty pool",
  group: "property-getters",
  fn: () => {
    const pool = new BitPool(1024);
    pool.nextAvailableIndex;
  },
});

Deno.bench({
  name: "nextAvailableIndex getter - partially filled",
  group: "property-getters",
  fn: () => {
    const pool = new BitPool(1024);
    for (let i = 0; i < 100; i++) {
      pool.acquire();
    }
    pool.nextAvailableIndex;
  },
});

// MAX_SAFE_BITPOOL_SIZE static getter benchmark
Deno.bench({
  name: "MAX_SAFE_BITPOOL_SIZE static getter",
  group: "static-getters",
  fn: () => {
    BitPool.MAX_SAFE_BITPOOL_SIZE;
  },
});

// Very large pool benchmarks
Deno.bench({
  name: "Large pool - constructor (1M bits)",
  group: "large-pools",
  fn: () => {
    new BitPool(1000000);
  },
});

Deno.bench({
  name: "Large pool - acquire first bit (1M bits)",
  group: "large-pools",
  fn: () => {
    const pool = new BitPool(1000000);
    pool.acquire();
  },
});

Deno.bench({
  name: "Large pool - acquire after many operations (1M bits)",
  group: "large-pools",
  fn: () => {
    const pool = new BitPool(1000000);
    // Fill first few chunks to force hierarchy traversal
    for (let i = 0; i < 1000; i++) {
      pool.acquire();
    }
    pool.acquire();
  },
});

// Multi-level hierarchy stress tests
Deno.bench({
  name: "Multi-level hierarchy - deep hierarchy pool",
  group: "hierarchy-stress",
  fn: () => {
    // Create pool large enough for multiple hierarchy levels
    const pool = new BitPool(32768); // 1024 data words, 32 hierarchy words
    pool.acquire();
  },
});

Deno.bench({
  name: "Multi-level hierarchy - acquire across boundaries",
  group: "hierarchy-stress",
  fn: () => {
    const pool = new BitPool(32768);
    // Fill first hierarchy chunk completely
    for (let i = 0; i < 1024; i++) {
      pool.acquire();
    }
    // Next acquire should traverse to next hierarchy chunk
    pool.acquire();
  },
});

Deno.bench({
  name: "Multi-level hierarchy - fragmented state",
  group: "hierarchy-stress",
  fn: () => {
    const pool = new BitPool(32768);
    const acquired: number[] = [];
    // Create fragmentation across multiple hierarchy chunks
    for (let i = 0; i < 2000; i++) {
      acquired.push(pool.acquire());
    }
    // Release every 5th bit
    for (let i = 0; i < acquired.length; i += 5) {
      pool.release(acquired[i]!);
    }
    // Try to acquire in fragmented state
    pool.acquire();
  },
});

// Sequential vs random access patterns
Deno.bench({
  name: "Sequential access - acquire sequential bits",
  group: "access-patterns",
  fn: () => {
    const pool = new BitPool(1024);
    for (let i = 0; i < 100; i++) {
      pool.acquire();
    }
  },
});

Deno.bench({
  name: "Random access - isOccupied random positions",
  group: "access-patterns",
  fn: () => {
    const pool = new BitPool(1024);
    // Acquire some bits first
    for (let i = 0; i < 100; i++) {
      pool.acquire();
    }
    // Check random positions
    for (let i = 0; i < 50; i++) {
      const pos = Math.floor(Math.random() * 1024);
      pool.isOccupied(pos);
    }
  },
});

Deno.bench({
  name: "Scattered access - acquire/release scattered pattern",
  group: "access-patterns",
  fn: () => {
    const pool = new BitPool(1024);
    const positions = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    // Acquire scattered positions
    for (const pos of positions) {
      while (pool.acquire() !== pos && pool.acquire() !== -1) {
        // Keep acquiring until we get the desired position or run out
      }
    }
  },
});

// Error handling performance
Deno.bench({
  name: "Error handling - isOccupied out of bounds",
  group: "error-handling",
  fn: () => {
    const pool = new BitPool(32);
    try {
      pool.isOccupied(100);
    } catch {
      // Expected error
    }
  },
});

Deno.bench({
  name: "Error handling - release invalid positions",
  group: "error-handling",
  fn: () => {
    const pool = new BitPool(32);
    pool.release(-1);
    pool.release(1000);
  },
});

Deno.bench({
  name: "Error handling - refresh with invalid index",
  group: "error-handling",
  fn: () => {
    const pool = new BitPool(32);
    try {
      pool.refresh(1000);
    } catch {
      // Expected error
    }
  },
});

// Memory-intensive scenarios
Deno.bench({
  name: "Memory intensive - rapid pool creation/destruction",
  group: "memory-intensive",
  fn: () => {
    for (let i = 0; i < 10; i++) {
      const pool = new BitPool(1000);
      pool.acquire();
    }
  },
});

Deno.bench({
  name: "Memory intensive - large fromArray operation",
  group: "memory-intensive",
  fn: () => {
    const arr = Array(100).fill(0xAAAAAAAA);
    BitPool.fromArray(arr, 5000);
  },
});

// Hierarchy boundary operations
Deno.bench({
  name: "Hierarchy boundary - operations at word boundaries",
  group: "hierarchy-boundaries",
  fn: () => {
    const pool = new BitPool(128); // 4 words, spans boundaries
    // Acquire bits right at 32-bit boundaries
    const positions = [31, 32, 63, 64, 95, 96];
    for (const pos of positions) {
      while (pool.acquire() !== pos && pool.acquire() !== -1) {
        // Keep acquiring until we get the desired position
      }
    }
  },
});

Deno.bench({
  name: "Hierarchy boundary - release at boundaries",
  group: "hierarchy-boundaries",
  fn: () => {
    const pool = new BitPool(128);
    // Acquire first bit of each word
    const bits = [0, 32, 64, 96];
    for (const bit of bits) {
      while (pool.acquire() !== bit) {
        // Keep acquiring until we get the desired bit
      }
    }
    // Release all boundary bits
    for (const bit of bits) {
      pool.release(bit);
    }
  },
});

// Pool near-exhaustion scenarios
Deno.bench({
  name: "Near exhaustion - 95% full acquire",
  group: "near-exhaustion",
  fn: () => {
    const pool = new BitPool(1000);
    // Fill 95% of the pool
    for (let i = 0; i < 950; i++) {
      pool.acquire();
    }
    // Try to acquire more
    pool.acquire();
  },
});

Deno.bench({
  name: "Near exhaustion - 99% full acquire",
  group: "near-exhaustion",
  fn: () => {
    const pool = new BitPool(1000);
    // Fill 99% of the pool
    for (let i = 0; i < 990; i++) {
      pool.acquire();
    }
    // Try to acquire more
    pool.acquire();
  },
});

Deno.bench({
  name: "Near exhaustion - last bit operations",
  group: "near-exhaustion",
  fn: () => {
    const pool = new BitPool(32);
    // Fill all but last bit
    for (let i = 0; i < 31; i++) {
      pool.acquire();
    }
    // Acquire last bit
    const lastBit = pool.acquire();
    // Check if pool is full
    pool.acquire(); // Should return -1
    // Release and reacquire last bit
    pool.release(lastBit);
    pool.acquire();
  },
});

// Rapid acquire/release at hierarchy boundaries
Deno.bench({
  name: "Rapid boundary operations - word boundary cycling",
  group: "rapid-boundary",
  fn: () => {
    const pool = new BitPool(128);
    // Rapidly acquire and release at word boundaries
    for (let cycle = 0; cycle < 10; cycle++) {
      const bit31 = 31;
      const bit32 = 32;
      // Acquire boundary bits
      while (pool.acquire() !== bit31) { /* Keep trying */ }
      while (pool.acquire() !== bit32) { /* Keep trying */ }
      // Release them
      pool.release(bit31);
      pool.release(bit32);
    }
  },
});

Deno.bench({
  name: "Rapid boundary operations - hierarchy word transitions",
  group: "rapid-boundary",
  fn: () => {
    const pool = new BitPool(2048); // Multiple hierarchy words
    const acquired: number[] = [];
    // Fill first hierarchy chunk
    for (let i = 0; i < 1024; i++) {
      acquired.push(pool.acquire());
    }
    // Rapidly release and reacquire to stress hierarchy updates
    for (let i = 0; i < 100; i++) {
      pool.release(acquired[i]!);
      pool.acquire(); // Should reuse the released bit
    }
  },
});

// Fragmentation recovery benchmarks
Deno.bench({
  name: "Fragmentation recovery - heavy fragmentation cleanup",
  group: "fragmentation-recovery",
  fn: () => {
    const pool = new BitPool(1024);
    const acquired: number[] = [];
    // Acquire all bits
    for (let i = 0; i < 1024; i++) {
      acquired.push(pool.acquire());
    }
    // Create heavy fragmentation - release every 3rd bit
    for (let i = 0; i < acquired.length; i += 3) {
      pool.release(acquired[i]!);
    }
    // Force refresh to rebuild hierarchy
    pool.refresh();
    // Try to acquire in cleaned up state
    for (let i = 0; i < 100; i++) {
      if (pool.acquire() === -1) break;
    }
  },
});

Deno.bench({
  name: "Fragmentation recovery - alternating pattern recovery",
  group: "fragmentation-recovery",
  fn: () => {
    const pool = new BitPool(512);
    const acquired: number[] = [];
    // Acquire all bits
    for (let i = 0; i < 512; i++) {
      acquired.push(pool.acquire());
    }
    // Create alternating pattern - release every other bit
    for (let i = 0; i < acquired.length; i += 2) {
      pool.release(acquired[i]!);
    }
    // Test performance of acquiring in alternating pattern
    for (let i = 0; i < 50; i++) {
      pool.acquire();
    }
  },
});

Deno.bench({
  name: "Fragmentation recovery - sparse fragmentation handling",
  group: "fragmentation-recovery",
  fn: () => {
    const pool = new BitPool(2048);
    const acquired: number[] = [];
    // Acquire many bits
    for (let i = 0; i < 1500; i++) {
      acquired.push(pool.acquire());
    }
    // Create sparse fragmentation - release every 10th bit
    for (let i = 0; i < acquired.length; i += 10) {
      pool.release(acquired[i]!);
    }
    // Test performance in sparse fragmented state
    for (let i = 0; i < 50; i++) {
      pool.acquire();
    }
  },
});
