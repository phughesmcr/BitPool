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

// =============================================================================
// OVERRIDDEN BOOLEANARRAY METHODS BENCHMARKS
// =============================================================================

// getBool() benchmarks
Deno.bench({
  name: "getBool() - first bit",
  group: "getBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getBool(0);
  },
});

Deno.bench({
  name: "getBool() - last bit",
  group: "getBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getBool(MEDIUM_POOL_SIZE - 1);
  },
});

Deno.bench({
  name: "getBool() - middle bit",
  group: "getBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getBool(MEDIUM_POOL_SIZE / 2);
  },
});

Deno.bench({
  name: "getBool() - random access pattern",
  group: "getBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const positions = [0, 31, 32, 63, 64, 127, 256, 512, 1000];
    for (const pos of positions) {
      if (pos < MEDIUM_POOL_SIZE) pool.getBool(pos);
    }
  },
});

Deno.bench({
  name: "getBool() - after modifications",
  group: "getBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Modify pool state
    pool.acquire();
    pool.acquire();
    pool.setBool(100, false);
    // Test getBool performance
    pool.getBool(50);
    pool.getBool(100);
    pool.getBool(200);
  },
});

// getBools() benchmarks
Deno.bench({
  name: "getBools() - small range (10 bits)",
  group: "getBools",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getBools(0, 10);
  },
});

Deno.bench({
  name: "getBools() - medium range (100 bits)",
  group: "getBools",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getBools(100, 100);
  },
});

Deno.bench({
  name: "getBools() - large range (500 bits)",
  group: "getBools",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getBools(0, 500);
  },
});

Deno.bench({
  name: "getBools() - across word boundaries",
  group: "getBools",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getBools(30, 10); // Spans 32-bit boundary
  },
});

Deno.bench({
  name: "getBools() - entire pool",
  group: "getBools",
  fn: () => {
    const pool = new BitPool(256); // Smaller for full read
    pool.getBools(0, 256);
  },
});

Deno.bench({
  name: "getBools() - with mixed state",
  group: "getBools",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Create mixed state
    for (let i = 0; i < 100; i += 2) {
      pool.setBool(i, false);
    }
    pool.getBools(0, 200);
  },
});

// setBool() benchmarks
Deno.bench({
  name: "setBool() - set to false (occupy)",
  group: "setBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setBool(100, false);
  },
});

Deno.bench({
  name: "setBool() - set to true (release)",
  group: "setBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setBool(100, false); // First occupy
    pool.setBool(100, true); // Then release
  },
});

Deno.bench({
  name: "setBool() - word boundary transitions",
  group: "setBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setBool(31, false); // Last bit of first word
    pool.setBool(32, false); // First bit of second word
  },
});

Deno.bench({
  name: "setBool() - hierarchy updates",
  group: "setBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Fill a word completely to trigger hierarchy updates
    for (let i = 0; i < 32; i++) {
      pool.setBool(i, false);
    }
    // Now set one back to trigger hierarchy update
    pool.setBool(15, true);
  },
});

Deno.bench({
  name: "setBool() - sequential pattern",
  group: "setBool",
  fn: () => {
    const pool = new BitPool(256);
    for (let i = 0; i < 100; i++) {
      pool.setBool(i, false);
    }
  },
});

Deno.bench({
  name: "setBool() - random pattern",
  group: "setBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const positions = [5, 67, 123, 456, 789, 999];
    for (const pos of positions) {
      pool.setBool(pos, false);
    }
  },
});

// setRange() benchmarks
Deno.bench({
  name: "setRange() - small range (10 bits) to false",
  group: "setRange",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(0, 10, false);
  },
});

Deno.bench({
  name: "setRange() - medium range (100 bits) to false",
  group: "setRange",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(100, 100, false);
  },
});

Deno.bench({
  name: "setRange() - large range (500 bits) to false",
  group: "setRange",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(0, 500, false);
  },
});

Deno.bench({
  name: "setRange() - small range (10 bits) to true",
  group: "setRange",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(0, 10, false); // First set to false
    pool.setRange(0, 10, true); // Then back to true
  },
});

Deno.bench({
  name: "setRange() - across word boundaries",
  group: "setRange",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(30, 10, false); // Spans 32-bit boundary
  },
});

Deno.bench({
  name: "setRange() - multiple word spans",
  group: "setRange",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(0, 100, false); // Spans multiple 32-bit words
  },
});

Deno.bench({
  name: "setRange() - alternating pattern",
  group: "setRange",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    for (let i = 0; i < 200; i += 20) {
      pool.setRange(i, 10, false);
    }
  },
});

// toggleBool() benchmarks
Deno.bench({
  name: "toggleBool() - single bit",
  group: "toggleBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.toggleBool(100);
  },
});

Deno.bench({
  name: "toggleBool() - word boundaries",
  group: "toggleBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.toggleBool(31); // Last bit of first word
    pool.toggleBool(32); // First bit of second word
  },
});

Deno.bench({
  name: "toggleBool() - hierarchy transitions",
  group: "toggleBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Fill a word except one bit
    for (let i = 0; i < 31; i++) {
      pool.toggleBool(i);
    }
    // Toggle the last bit to make word empty
    pool.toggleBool(31);
  },
});

Deno.bench({
  name: "toggleBool() - sequential pattern",
  group: "toggleBool",
  fn: () => {
    const pool = new BitPool(256);
    for (let i = 0; i < 100; i++) {
      pool.toggleBool(i);
    }
  },
});

Deno.bench({
  name: "toggleBool() - back and forth",
  group: "toggleBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const pos = 100;
    for (let i = 0; i < 50; i++) {
      pool.toggleBool(pos);
    }
  },
});

// forEachBool() benchmarks
Deno.bench({
  name: "forEachBool() - small range (100 bits)",
  group: "forEachBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    let count = 0;
    pool.forEachBool(() => count++, 0, 100);
  },
});

Deno.bench({
  name: "forEachBool() - medium range (500 bits)",
  group: "forEachBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    let count = 0;
    pool.forEachBool(() => count++, 0, 500);
  },
});

Deno.bench({
  name: "forEachBool() - entire pool",
  group: "forEachBool",
  fn: () => {
    const pool = new BitPool(512); // Smaller for full iteration
    let count = 0;
    pool.forEachBool(() => count++);
  },
});

Deno.bench({
  name: "forEachBool() - with complex callback",
  group: "forEachBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const results: number[] = [];
    pool.forEachBool(
      (index, value) => {
        if (value) results.push(index);
      },
      0,
      200,
    );
  },
});

Deno.bench({
  name: "forEachBool() - mixed state pool",
  group: "forEachBool",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Create mixed state
    for (let i = 0; i < 100; i += 2) {
      pool.setBool(i, false);
    }
    let trueCount = 0;
    pool.forEachBool(
      (_, value) => {
        if (value) trueCount++;
      },
      0,
      200,
    );
  },
});

// getFirstSetIndex() benchmarks
Deno.bench({
  name: "getFirstSetIndex() - first bit set",
  group: "getFirstSetIndex",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getFirstSetIndex();
  },
});

Deno.bench({
  name: "getFirstSetIndex() - empty pool",
  group: "getFirstSetIndex",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Clear all bits
    pool.setRange(0, MEDIUM_POOL_SIZE, false);
    pool.getFirstSetIndex();
  },
});

Deno.bench({
  name: "getFirstSetIndex() - sparse pattern",
  group: "getFirstSetIndex",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Clear most bits, leave a few scattered
    pool.setRange(0, MEDIUM_POOL_SIZE, false);
    pool.setBool(500, true);
    pool.getFirstSetIndex();
  },
});

Deno.bench({
  name: "getFirstSetIndex() - with start index",
  group: "getFirstSetIndex",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getFirstSetIndex(500);
  },
});

Deno.bench({
  name: "getFirstSetIndex() - across word boundaries",
  group: "getFirstSetIndex",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Clear first word, leave second word
    pool.setRange(0, 32, false);
    pool.getFirstSetIndex();
  },
});

// getLastSetIndex() benchmarks
Deno.bench({
  name: "getLastSetIndex() - last bit set",
  group: "getLastSetIndex",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getLastSetIndex();
  },
});

Deno.bench({
  name: "getLastSetIndex() - empty pool",
  group: "getLastSetIndex",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(0, MEDIUM_POOL_SIZE, false);
    pool.getLastSetIndex();
  },
});

Deno.bench({
  name: "getLastSetIndex() - sparse pattern",
  group: "getLastSetIndex",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(0, MEDIUM_POOL_SIZE, false);
    pool.setBool(100, true);
    pool.getLastSetIndex();
  },
});

Deno.bench({
  name: "getLastSetIndex() - with end index",
  group: "getLastSetIndex",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getLastSetIndex(500);
  },
});

Deno.bench({
  name: "getLastSetIndex() - across word boundaries",
  group: "getLastSetIndex",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(32, MEDIUM_POOL_SIZE - 32, false); // Clear from second word onward
    pool.getLastSetIndex();
  },
});

// getPopulationCount() benchmarks
Deno.bench({
  name: "getPopulationCount() - full pool",
  group: "getPopulationCount",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.getPopulationCount();
  },
});

Deno.bench({
  name: "getPopulationCount() - empty pool",
  group: "getPopulationCount",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(0, MEDIUM_POOL_SIZE, false);
    pool.getPopulationCount();
  },
});

Deno.bench({
  name: "getPopulationCount() - half full",
  group: "getPopulationCount",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(0, MEDIUM_POOL_SIZE / 2, false);
    pool.getPopulationCount();
  },
});

Deno.bench({
  name: "getPopulationCount() - alternating pattern",
  group: "getPopulationCount",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    for (let i = 0; i < MEDIUM_POOL_SIZE; i += 2) {
      pool.setBool(i, false);
    }
    pool.getPopulationCount();
  },
});

Deno.bench({
  name: "getPopulationCount() - partial word boundary",
  group: "getPopulationCount",
  fn: () => {
    const pool = new BitPool(50); // Not divisible by 32
    pool.getPopulationCount();
  },
});

Deno.bench({
  name: "getPopulationCount() - large pool",
  group: "getPopulationCount",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    pool.getPopulationCount();
  },
});

// isEmpty() benchmarks
Deno.bench({
  name: "isEmpty() - full pool",
  group: "isEmpty",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.isEmpty();
  },
});

Deno.bench({
  name: "isEmpty() - empty pool",
  group: "isEmpty",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(0, MEDIUM_POOL_SIZE, false);
    pool.isEmpty();
  },
});

Deno.bench({
  name: "isEmpty() - single bit set",
  group: "isEmpty",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.setRange(0, MEDIUM_POOL_SIZE, false);
    pool.setBool(MEDIUM_POOL_SIZE - 1, true);
    pool.isEmpty();
  },
});

Deno.bench({
  name: "isEmpty() - large pool",
  group: "isEmpty",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    pool.isEmpty();
  },
});

Deno.bench({
  name: "isEmpty() - after modifications",
  group: "isEmpty",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Make some modifications
    pool.acquire();
    pool.acquire();
    pool.setBool(100, false);
    pool.isEmpty();
  },
});

// clone() benchmarks
Deno.bench({
  name: "clone() - small pool",
  group: "clone",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    pool.clone();
  },
});

Deno.bench({
  name: "clone() - medium pool",
  group: "clone",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.clone();
  },
});

Deno.bench({
  name: "clone() - large pool",
  group: "clone",
  fn: () => {
    const pool = new BitPool(5000); // Reasonable size for cloning
    pool.clone();
  },
});

Deno.bench({
  name: "clone() - modified pool",
  group: "clone",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Make modifications before cloning
    for (let i = 0; i < 100; i++) {
      pool.acquire();
    }
    pool.clone();
  },
});

Deno.bench({
  name: "clone() - fragmented pool",
  group: "clone",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Create fragmentation
    for (let i = 0; i < 200; i += 2) {
      pool.setBool(i, false);
    }
    pool.clone();
  },
});

// clear() benchmarks
Deno.bench({
  name: "clear() - small pool",
  group: "clear",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    pool.clear();
  },
});

Deno.bench({
  name: "clear() - medium pool",
  group: "clear",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.clear();
  },
});

Deno.bench({
  name: "clear() - large pool",
  group: "clear",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    pool.clear();
  },
});

Deno.bench({
  name: "clear() - after modifications",
  group: "clear",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Make modifications first
    for (let i = 0; i < 100; i++) {
      pool.acquire();
    }
    pool.clear();
  },
});

Deno.bench({
  name: "clear() - fragmented pool",
  group: "clear",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Create fragmentation
    for (let i = 0; i < 200; i += 3) {
      pool.setBool(i, false);
    }
    pool.clear();
  },
});

// setAll() benchmarks
Deno.bench({
  name: "setAll() - small pool",
  group: "setAll",
  fn: () => {
    const pool = new BitPool(SMALL_POOL_SIZE);
    pool.clear(); // Clear first
    pool.setAll();
  },
});

Deno.bench({
  name: "setAll() - medium pool",
  group: "setAll",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    pool.clear(); // Clear first
    pool.setAll();
  },
});

Deno.bench({
  name: "setAll() - large pool",
  group: "setAll",
  fn: () => {
    const pool = new BitPool(LARGE_POOL_SIZE);
    pool.clear(); // Clear first
    pool.setAll();
  },
});

Deno.bench({
  name: "setAll() - partial word boundary",
  group: "setAll",
  fn: () => {
    const pool = new BitPool(50); // Not divisible by 32
    pool.clear();
    pool.setAll();
  },
});

Deno.bench({
  name: "setAll() - after fragmentation",
  group: "setAll",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    // Create fragmentation first
    for (let i = 0; i < 200; i += 2) {
      pool.setBool(i, false);
    }
    pool.setAll();
  },
});

// truthyIndices() benchmarks
Deno.bench({
  name: "truthyIndices() - full pool iteration",
  group: "truthyIndices",
  fn: () => {
    const pool = new BitPool(256); // Reasonable size for full iteration
    const indices = Array.from(pool.truthyIndices());
    void indices; // Intentionally unused in benchmark
  },
});

Deno.bench({
  name: "truthyIndices() - empty pool iteration",
  group: "truthyIndices",
  fn: () => {
    const pool = new BitPool(256);
    pool.clear();
    const indices = Array.from(pool.truthyIndices());
    void indices; // Intentionally unused in benchmark
  },
});

Deno.bench({
  name: "truthyIndices() - sparse pattern",
  group: "truthyIndices",
  fn: () => {
    const pool = new BitPool(256);
    pool.clear();
    // Set every 10th bit
    for (let i = 0; i < 256; i += 10) {
      pool.setBool(i, true);
    }
    const indices = Array.from(pool.truthyIndices());
    void indices; // Intentionally unused in benchmark
  },
});

Deno.bench({
  name: "truthyIndices() - with range",
  group: "truthyIndices",
  fn: () => {
    const pool = new BitPool(MEDIUM_POOL_SIZE);
    const indices = Array.from(pool.truthyIndices(100, 300));
    void indices; // Intentionally unused in benchmark
  },
});

Deno.bench({
  name: "truthyIndices() - alternating pattern",
  group: "truthyIndices",
  fn: () => {
    const pool = new BitPool(256);
    // Create alternating pattern
    for (let i = 0; i < 256; i += 2) {
      pool.setBool(i, false);
    }
    const indices = Array.from(pool.truthyIndices());
    void indices; // Intentionally unused in benchmark
  },
});

Deno.bench({
  name: "truthyIndices() - word boundary spans",
  group: "truthyIndices",
  fn: () => {
    const pool = new BitPool(128);
    // Set bits across word boundaries
    pool.setBool(31, true);
    pool.setBool(32, true);
    pool.setBool(63, true);
    pool.setBool(64, true);
    const indices = Array.from(pool.truthyIndices(30, 70));
    void indices; // Intentionally unused in benchmark
  },
});

// Combined override operations benchmarks
Deno.bench({
  name: "Combined overrides - mixed read operations",
  group: "combined-overrides",
  fn: () => {
    const pool = new BitPool(512);
    // Mix of read operations
    pool.getBool(100);
    pool.getBools(200, 50);
    pool.getFirstSetIndex();
    pool.getLastSetIndex();
    pool.getPopulationCount();
    pool.isEmpty();
  },
});

Deno.bench({
  name: "Combined overrides - mixed write operations",
  group: "combined-overrides",
  fn: () => {
    const pool = new BitPool(512);
    // Mix of write operations
    pool.setBool(100, false);
    pool.setRange(200, 20, false);
    pool.toggleBool(300);
    pool.setBool(100, true);
  },
});

Deno.bench({
  name: "Combined overrides - complex workflow",
  group: "combined-overrides",
  fn: () => {
    const pool = new BitPool(256);
    // Simulate complex usage pattern

    // Initial setup
    pool.setRange(0, 50, false);

    // Analysis
    const count1 = pool.getPopulationCount();
    const firstSet = pool.getFirstSetIndex();

    // Modifications
    pool.toggleBool(25);
    pool.setBool(75, false);

    // Bulk read
    const values = pool.getBools(20, 60);

    // Final analysis
    const count2 = pool.getPopulationCount();
    const isEmpty = pool.isEmpty();

    // Use variables to avoid linter warnings
    void count1;
    void firstSet;
    void values;
    void count2;
    void isEmpty;
  },
});

Deno.bench({
  name: "Combined overrides - hierarchy stress test",
  group: "combined-overrides",
  fn: () => {
    const pool = new BitPool(1024); // Multiple hierarchy words

    // Create pattern that stresses hierarchy
    for (let word = 0; word < 32; word++) {
      // Fill every other word completely
      if (word % 2 === 0) {
        pool.setRange(word * 32, 32, false);
      }
    }

    // Operations that traverse hierarchy
    pool.getFirstSetIndex();
    pool.getPopulationCount();

    // Modify to trigger hierarchy updates
    pool.setBool(15, true); // In a cleared word
    pool.setBool(50, false); // In a set word

    // Re-analyze
    pool.getFirstSetIndex();
    pool.isEmpty();
  },
});

Deno.bench({
  name: "Combined overrides - iterator performance",
  group: "combined-overrides",
  fn: () => {
    const pool = new BitPool(512);

    // Create interesting pattern
    for (let i = 0; i < 512; i += 3) {
      pool.setBool(i, false);
    }

    // Test different iteration methods
    const truthyCount = Array.from(pool.truthyIndices()).length;

    let forEachCount = 0;
    pool.forEachBool((_, value) => {
      if (value) forEachCount++;
    });

    const popCount = pool.getPopulationCount();

    // Use variables to avoid linter warnings
    void truthyCount;
    void forEachCount;
    void popCount;
  },
});

// Performance comparison benchmarks (overridden vs original functionality)
Deno.bench({
  name: "Override comparison - size vs actual size",
  group: "override-comparison",
  fn: () => {
    const pool = new BitPool(512);
    // Test that overridden methods use actual size, not total array size
    const actualSize = pool.size; // Should be 512

    // These should all respect the 512 limit, not the larger underlying array
    pool.getBool(actualSize - 1); // Should work
    pool.getPopulationCount(); // Should count only 512 bits
    pool.isEmpty(); // Should check only 512 bits

    try {
      pool.getBool(actualSize); // Should throw
    } catch {
      // Expected
    }
  },
});

Deno.bench({
  name: "Override comparison - hierarchy maintenance",
  group: "override-comparison",
  fn: () => {
    const pool = new BitPool(128);

    // Operations that should maintain hierarchy
    pool.setBool(31, false); // Word boundary
    pool.setRange(32, 32, false); // Entire word
    pool.toggleBool(64); // Another word

    // Verify hierarchy is maintained by testing acquire performance
    const startTime = performance.now();
    const bit = pool.acquire(); // Should be fast due to hierarchy
    const endTime = performance.now();

    if (bit !== -1) {
      pool.release(bit);
    }

    // Use timing variables to avoid linter warnings
    void startTime;
    void endTime;
  },
});
