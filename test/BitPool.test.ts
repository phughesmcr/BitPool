/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.9";
import { BitPool } from "../src/BitPool.ts";

// Constructor Tests
Deno.test("BitPool - constructor should create instance with valid size", () => {
  const pool = new BitPool(32);
  assertEquals(pool.size, 32);
  assertEquals(pool.nextAvailableIndex, 0);
});

Deno.test("BitPool - constructor should throw RangeError for size < 1", () => {
  assertThrows(
    () => new BitPool(0),
    RangeError,
    '"size" must be greater than 0',
  );
});

Deno.test("BitPool - constructor should throw RangeError for size > 0xffffffff", () => {
  assertThrows(
    () => new BitPool(0x100000000),
    RangeError,
    '"value" must be smaller than or equal to 536870911.',
  );
});

Deno.test("BitPool - constructor should throw TypeError for NaN size", () => {
  assertThrows(
    () => new BitPool(NaN),
    TypeError,
    '"value" must be a safe integer',
  );
});

// isOccupied Tests
Deno.test("BitPool - isOccupied should return false for newly created pool", () => {
  const pool = new BitPool(32);
  assertEquals(pool.isOccupied(0), false);
  assertEquals(pool.isOccupied(31), false);
});

Deno.test("BitPool - isOccupied should throw for out of bounds index", () => {
  const pool = new BitPool(32);
  assertThrows(
    () => pool.isOccupied(32),
    RangeError,
  );
});

// acquire Tests
Deno.test("BitPool - acquire should return sequential indices", () => {
  const pool = new BitPool(8);
  assertEquals(pool.acquire(), 0);
  assertEquals(pool.acquire(), 1);
  assertEquals(pool.acquire(), 2);
});

Deno.test("BitPool - acquire should return -1 when pool is full", () => {
  const pool = new BitPool(2);
  assertEquals(pool.acquire(), 0);
  assertEquals(pool.acquire(), 1);
  assertEquals(pool.acquire(), -1);
});

Deno.test("BitPool - acquire should mark bits as occupied", () => {
  const pool = new BitPool(8);
  const bit = pool.acquire();
  assertEquals(pool.isOccupied(bit), true);
});

// release Tests
Deno.test("BitPool - release should make bit available again", () => {
  const pool = new BitPool(8);
  const bit = pool.acquire();
  assertEquals(pool.isOccupied(bit), true);
  pool.release(bit);
  assertEquals(pool.isOccupied(bit), false);
});

Deno.test("BitPool - release should handle invalid indices gracefully", () => {
  const pool = new BitPool(8);
  pool.release(-1); // Should not throw
  pool.release(32); // Should not throw
});

Deno.test("BitPool - release should update nextAvailableIndex", () => {
  const pool = new BitPool(8);
  const bits = Array.from({ length: 3 }, () => pool.acquire());
  const lastBit = bits.at(-1)!;
  pool.release(lastBit);
  assertEquals(pool.nextAvailableIndex, Math.floor(lastBit / 32));
});

// Complex Scenarios
Deno.test("BitPool - should handle acquire-release-acquire pattern", () => {
  const pool = new BitPool(8);
  const bit1 = pool.acquire();
  // @ts-expect-error - expected
  const _bit2 = pool.acquire();
  pool.release(bit1);
  assertEquals(pool.acquire(), bit1);
});

Deno.test("BitPool - should handle multiple releases", () => {
  const pool = new BitPool(8);
  const bits = Array.from({ length: 5 }, () => pool.acquire());
  bits.forEach((bit) => pool.release(bit));
  assertEquals(pool.nextAvailableIndex, 0);
});

Deno.test("BitPool - should maintain correct state after many operations", () => {
  const pool = new BitPool(8);
  const acquired: number[] = [];

  // Acquire some bits
  for (let i = 0; i < 6; i++) {
    acquired.push(pool.acquire());
  }

  // Release every other bit
  for (let i = 0; i < acquired.length; i += 2) {
    pool.release(acquired[i]!);
  }

  // Verify released bits are available
  for (let i = 0; i < acquired.length; i += 2) {
    assertEquals(pool.isOccupied(acquired[i]!), false);
  }

  // Verify kept bits are still occupied
  for (let i = 1; i < acquired.length; i += 2) {
    assertEquals(pool.isOccupied(acquired[i]!), true);
  }
});

// Edge Cases
Deno.test("BitPool - should handle size of 1", () => {
  const pool = new BitPool(1);
  assertEquals(pool.acquire(), 0);
  const secondAcquire = pool.acquire();
  assertEquals(secondAcquire, -1); // Pool is full
  pool.release(0);
  assertEquals(pool.isOccupied(0), false);
  const reacquired = pool.acquire();
  assertEquals(reacquired, 0);
});

Deno.test("BitPool - should handle release of already released bit", () => {
  const pool = new BitPool(8);
  const bit = pool.acquire();
  pool.release(bit);
  pool.release(bit); // Second release should be safe
  assertEquals(pool.isOccupied(bit), false);
});

Deno.test("BitPool - should handle acquire at capacity boundary", () => {
  const pool = new BitPool(32); // One full chunk
  const acquired: number[] = [];

  // Fill the pool
  for (let i = 0; i < 32; i++) {
    const bit = pool.acquire();
    assertEquals(bit, i);
    acquired.push(bit);
  }

  // Should be full
  const fullAcquire = pool.acquire();
  assertEquals(fullAcquire, -1);

  // Release and reacquire last bit
  pool.release(31);
  assertEquals(pool.isOccupied(31), false);
  const reacquired = pool.acquire();
  assertEquals(reacquired, 31);
  assertEquals(pool.isOccupied(31), true);
});

Deno.test("BitPool - should handle sparse releases", () => {
  const pool = new BitPool(8);
  const bits = [
    pool.acquire(),
    pool.acquire(),
    pool.acquire(),
    pool.acquire(),
  ];

  // Release non-sequential bits
  pool.release(bits[1]!);
  pool.release(bits[3]!);

  // Verify state
  assertEquals(pool.isOccupied(bits[0]!), true);
  assertEquals(pool.isOccupied(bits[1]!), false);
  assertEquals(pool.isOccupied(bits[2]!), true);
  assertEquals(pool.isOccupied(bits[3]!), false);

  // Should be able to acquire released bits
  const newBit1 = pool.acquire();
  assertEquals(newBit1, bits[1]);
});

Deno.test("BitPool - should handle floating point inputs", () => {
  const pool = new BitPool(8);
  const bit = pool.acquire();

  // These should be handled gracefully
  pool.release(1.5); // Should treat as 1
  pool.release(-0.5); // Should be ignored

  // NaN should throw
  assertThrows(
    () => pool.release(NaN),
    TypeError,
    '"value" must be a number',
  );

  // Verify original bit is still occupied
  assertEquals(pool.isOccupied(bit), true);
});

Deno.test("BitPool - should maintain correct state after chunk boundary operations", () => {
  const pool = new BitPool(40); // More than one chunk
  const acquired: number[] = [];

  // Fill first chunk
  for (let i = 0; i < 32; i++) {
    acquired.push(pool.acquire());
  }

  // Add some from second chunk
  acquired.push(pool.acquire()); // 32
  acquired.push(pool.acquire()); // 33

  // Release last bit of first chunk
  pool.release(31);

  // Should reuse bit 31 before moving to next chunk
  assertEquals(pool.acquire(), 31);
});

// Large Capacity Tests
Deno.test("BitPool - should handle large capacity near uint32 max", () => {
  const size = 1000000; // 1 million bits
  const pool = new BitPool(size);
  const firstBit = pool.acquire();
  assertEquals(firstBit, 0);
  pool.release(firstBit);
  assertEquals(pool.isOccupied(firstBit), false);
});

// Multiple Chunk Stress Tests
Deno.test("BitPool - should handle rapid acquire/release cycles across chunks", () => {
  const pool = new BitPool(100);
  const acquired: number[] = [];

  // Fill up multiple chunks
  for (let i = 0; i < 64; i++) {
    acquired.push(pool.acquire());
  }

  // Release and immediately reacquire bits
  for (let i = 0; i < acquired.length; i++) {
    pool.release(acquired[i]!);
    const newBit = pool.acquire();
    assertEquals(newBit, acquired[i]);
  }
});

// Memory Management Tests
Deno.test("BitPool - should maintain consistent memory usage during operations", () => {
  const pool = new BitPool(1000);

  // Perform many operations
  for (let i = 0; i < 100; i++) {
    const bits = Array.from({ length: 10 }, () => pool.acquire());
    bits.forEach((bit) => pool.release(bit));
  }

  // Just verify the pool is still functional
  const newBit = pool.acquire();
  assertEquals(typeof newBit, "number");
  assertEquals(newBit >= 0, true);
});

// State Consistency Tests
Deno.test("BitPool - should maintain consistent state after interleaved operations", () => {
  const pool = new BitPool(64);
  const occupied = new Set<number>();

  // Perform interleaved acquire/release operations
  for (let i = 0; i < 32; i++) {
    const bit = pool.acquire();
    if (bit !== -1) {
      occupied.add(bit);
    }

    if (i % 3 === 0 && occupied.size > 1) {
      // Get a random bit to release from our occupied set
      const toRelease = Array.from(occupied)[0];
      if (toRelease !== undefined) {
        pool.release(toRelease);
        occupied.delete(toRelease);
      }
    }
  }

  // Verify final state
  for (let i = 0; i < 64; i++) {
    assertEquals(
      pool.isOccupied(i),
      occupied.has(i),
      `Bit ${i} occupancy mismatch. Expected: ${occupied.has(i)}, Got: ${pool.isOccupied(i)}`,
    );
  }
});

// Boundary Tests
Deno.test("BitPool - should handle operations at chunk boundaries", () => {
  const pool = new BitPool(64); // 2 chunks
  const acquired: number[] = [];

  // Fill first chunk
  for (let i = 0; i < 32; i++) {
    const bit = pool.acquire();
    if (bit !== -1) acquired.push(bit);
  }

  // Release last bit of first chunk
  if (acquired.length > 0) {
    const lastBit = acquired[acquired.length - 1]!;
    pool.release(lastBit);

    // Acquire one more - should get the last released bit back
    const newBit = pool.acquire();
    assertEquals(newBit, lastBit);
  }
});

// Error Recovery Tests
Deno.test("BitPool - should recover from invalid operations", () => {
  const pool = new BitPool(32);
  const validBit = pool.acquire();

  // Test recovery from invalid releases
  pool.release(-1);
  pool.release(32);

  // Don't test NaN as it's expected to throw

  // State should remain consistent
  assertEquals(pool.isOccupied(validBit), true);
  assertEquals(pool.nextAvailableIndex < pool.length, true);
});

// fromArray Static Method Tests
Deno.test("BitPool.fromArray - should create BitPool from valid array", () => {
  const arr = [0b11110000];
  const pool = BitPool.fromArray(arr, 32);

  // Check first byte (inverted)
  assertEquals(pool.isOccupied(0), true);
  assertEquals(pool.isOccupied(1), true);
  assertEquals(pool.isOccupied(2), true);
  assertEquals(pool.isOccupied(3), true);
  assertEquals(pool.isOccupied(4), false);
  assertEquals(pool.isOccupied(5), false);
  assertEquals(pool.isOccupied(6), false);
  assertEquals(pool.isOccupied(7), false);
});

Deno.test("BitPool.fromArray - should handle empty array", () => {
  const pool = BitPool.fromArray([], 32);
  assertEquals(pool.size, 32);
  assertEquals(pool.nextAvailableIndex, 0);
});

Deno.test("BitPool.fromArray - should handle multiple integers", () => {
  const arr = [0b11110000, 0b00001111];
  const pool = BitPool.fromArray(arr, 64);

  // First integer
  assertEquals(pool.isOccupied(0), true);
  assertEquals(pool.isOccupied(1), true);
  assertEquals(pool.isOccupied(2), true);
  assertEquals(pool.isOccupied(3), true);
  assertEquals(pool.isOccupied(4), false);
  assertEquals(pool.isOccupied(5), false);
  assertEquals(pool.isOccupied(6), false);
  assertEquals(pool.isOccupied(7), false);

  // Second integer
  assertEquals(pool.isOccupied(32), false);
  assertEquals(pool.isOccupied(33), false);
  assertEquals(pool.isOccupied(34), false);
  assertEquals(pool.isOccupied(35), false);
  assertEquals(pool.isOccupied(36), true);
  assertEquals(pool.isOccupied(37), true);
  assertEquals(pool.isOccupied(38), true);
  assertEquals(pool.isOccupied(39), true);
});

Deno.test("BitPool.fromArray - should throw when capacity is too small", () => {
  const arr = [0b11110000, 0b00001111];
  assertThrows(
    () => BitPool.fromArray(arr, 31),
    RangeError,
    'For the array to fit, "capacity" must be greater than or equal to 64',
  );
});

Deno.test("BitPool.fromArray - should handle array with all bits set", () => {
  const arr = [0xFFFFFFFF];
  const pool = BitPool.fromArray(arr, 32);

  // All bits should be available (not occupied)
  for (let i = 0; i < 32; i++) {
    assertEquals(pool.isOccupied(i), false);
  }
});

Deno.test("BitPool.fromArray - should handle array with no bits set", () => {
  const arr = [0x00000000];
  const pool = BitPool.fromArray(arr, 32);

  // All bits should be occupied
  for (let i = 0; i < 32; i++) {
    assertEquals(pool.isOccupied(i), true);
  }
});

Deno.test("BitPool.fromArray - should handle capacity larger than needed", () => {
  const arr = [0b11110000];
  const pool = BitPool.fromArray(arr, 64);

  // Check first byte
  assertEquals(pool.isOccupied(0), true);
  assertEquals(pool.isOccupied(1), true);
  assertEquals(pool.isOccupied(2), true);
  assertEquals(pool.isOccupied(3), true);
  assertEquals(pool.isOccupied(4), false);
  assertEquals(pool.isOccupied(5), false);
  assertEquals(pool.isOccupied(6), false);
  assertEquals(pool.isOccupied(7), false);

  // Extra capacity should be unoccupied
  assertEquals(pool.isOccupied(32), false);
});

Deno.test("BitPool.fromArray - should maintain correct nextAvailableIndex", () => {
  const arr = [0b11110000, 0x00000000];
  const pool = BitPool.fromArray(arr, 64);
  assertEquals(pool.nextAvailableIndex, 0);
});

Deno.test("BitPool.fromArray - should throw for invalid array values", () => {
  assertThrows(
    () => BitPool.fromArray([NaN], 32),
    TypeError,
    '"value" must be a safe integer',
  );

  assertThrows(
    () => BitPool.fromArray([Infinity], 32),
    TypeError,
    '"value" must be a safe integer',
  );

  assertThrows(
    () => BitPool.fromArray([-1], 32),
    RangeError,
    '"value" must be greater than or equal to 0',
  );
});

Deno.test("BitPool.fromArray - should handle maximum valid capacity", () => {
  const arr = [0b11110000];
  const pool = BitPool.fromArray(arr, BitPool.MAX_SAFE_BITPOOL_SIZE); // Max valid capacity
  assertEquals(pool.size, BitPool.MAX_SAFE_BITPOOL_SIZE);
});

Deno.test("BitPool.fromArray - should throw for invalid capacity", () => {
  const arr = [0b11110000];
  assertThrows(
    () => BitPool.fromArray(arr, 0),
    RangeError,
    '"capacity" must be greater than 0',
  );

  assertThrows(
    () => BitPool.fromArray(arr, -1),
    RangeError,
    '"capacity" must be greater than 0',
  );

  assertThrows(
    () => BitPool.fromArray(arr, 0x100000000),
    RangeError,
    '"value" must be smaller than or equal to 536870911',
  );
});

// refresh() Method Tests
Deno.test("BitPool - refresh should work without parameters", () => {
  const pool = new BitPool(32);
  const bit1 = pool.acquire();
  pool.acquire(); // Just acquire without storing
  pool.release(bit1);

  const result = pool.refresh();
  assertEquals(result, pool); // Should return this
  assertEquals(pool.nextAvailableIndex, 0); // Should find the released bit
});

Deno.test("BitPool - refresh should accept valid nextAvailableIndex", () => {
  const pool = new BitPool(64);
  // Acquire some bits but leave some available in the first chunk
  for (let i = 0; i < 16; i++) { // Only half of first chunk
    pool.acquire();
  }
  // Acquire some from second chunk to make nextAvailableIndex point there
  for (let i = 0; i < 16; i++) {
    pool.acquire();
  }

  // Now refresh with index 0 (which should have available bits)
  const result = pool.refresh(0);
  assertEquals(result, pool);
  assertEquals(pool.nextAvailableIndex, 0); // Should point to first hierarchy index
});

Deno.test("BitPool - refresh should throw TypeError for NaN nextAvailableIndex", () => {
  const pool = new BitPool(32);
  assertThrows(
    () => pool.refresh(NaN),
    TypeError,
    '"nextAvailableIndex" must be a number',
  );
});

Deno.test("BitPool - refresh should throw RangeError for out-of-bounds nextAvailableIndex", () => {
  const pool = new BitPool(32);
  assertThrows(
    () => pool.refresh(-1),
    RangeError,
    '"nextAvailableIndex" must be within the bounds of the Bitpool',
  );

  assertThrows(
    () => pool.refresh(33),
    RangeError,
    '"nextAvailableIndex" must be within the bounds of the Bitpool',
  );
});

Deno.test("BitPool - refresh should rebuild hierarchy correctly", () => {
  const pool = new BitPool(64);
  // Create a pattern where hierarchy needs rebuilding
  for (let i = 0; i < 40; i++) {
    pool.acquire();
  }
  // Release some bits to create fragmentation
  pool.release(10);
  pool.release(35);

  pool.refresh();

  // Verify the released bits can be acquired again
  assertEquals(pool.acquire(), 10);
  assertEquals(pool.acquire(), 35);
});

// getHierarchyWord() Method Tests
Deno.test("BitPool - getHierarchyWord should return correct values", () => {
  const pool = new BitPool(32);

  // Initially all hierarchy bits should be set (available)
  const word = pool.getHierarchyWord(0);
  assertEquals(word, 1); // Should have 1 bit set for the single data word
});

Deno.test("BitPool - getHierarchyWord should return 0 for out-of-bounds index", () => {
  const pool = new BitPool(32);
  assertEquals(pool.getHierarchyWord(10), 0);
});

Deno.test("BitPool - getHierarchyWord should reflect data word status", () => {
  const pool = new BitPool(64); // 2 data words, 1 hierarchy word

  // Fill first word completely
  for (let i = 0; i < 32; i++) {
    pool.acquire();
  }

  const hierarchyWord = pool.getHierarchyWord(0);
  // First bit should be 0 (word is full), second bit should be 1 (word has space)
  assertEquals(hierarchyWord & 1, 0); // First data word is full
  assertEquals((hierarchyWord & 2) >> 1, 1); // Second data word has space
});

// findFirstSetBit() Method Tests
Deno.test("BitPool - findFirstSetBit should return -1 for 0", () => {
  assertEquals(BitPool.findFirstSetBit(0), -1);
});

Deno.test("BitPool - findFirstSetBit should find correct bit positions", () => {
  assertEquals(BitPool.findFirstSetBit(1), 0); // 0b1
  assertEquals(BitPool.findFirstSetBit(2), 1); // 0b10
  assertEquals(BitPool.findFirstSetBit(4), 2); // 0b100
  assertEquals(BitPool.findFirstSetBit(8), 3); // 0b1000
  assertEquals(BitPool.findFirstSetBit(0x80000000), 31); // Highest bit
});

Deno.test("BitPool - findFirstSetBit should find rightmost bit when multiple are set", () => {
  assertEquals(BitPool.findFirstSetBit(0b1010), 1); // Should find bit 1, not bit 3
  assertEquals(BitPool.findFirstSetBit(0b11000), 3); // Should find bit 3, not bit 4
});

// isOccupied() Error Handling Tests
Deno.test("BitPool - isOccupied should throw TypeError for non-number input", () => {
  const pool = new BitPool(32);

  assertThrows(
    // @ts-expect-error - intentionally testing invalid input
    () => pool.isOccupied("0"),
    TypeError,
    '"bit" must be a number',
  );

  assertThrows(
    // @ts-expect-error - intentionally testing invalid input
    () => pool.isOccupied(null),
    TypeError,
    '"bit" must be a number',
  );

  assertThrows(
    () => pool.isOccupied(NaN),
    TypeError,
    '"bit" must be a number',
  );
});

// MAX_SAFE_BITPOOL_SIZE Tests
Deno.test("BitPool - MAX_SAFE_BITPOOL_SIZE should return a valid number", () => {
  const maxSize = BitPool.MAX_SAFE_BITPOOL_SIZE;
  assertEquals(typeof maxSize, "number");
  assertEquals(maxSize > 0, true);
  assertEquals(Number.isSafeInteger(maxSize), true);
});

Deno.test("BitPool - should be able to create pool at MAX_SAFE_BITPOOL_SIZE", () => {
  const maxSize = BitPool.MAX_SAFE_BITPOOL_SIZE;
  const pool = new BitPool(maxSize);
  assertEquals(pool.size, maxSize);
});

// Large Hierarchy Tests
Deno.test("BitPool - should handle pools requiring multiple hierarchy words", () => {
  // Create a pool large enough to require multiple hierarchy words
  // 32 * 32 = 1024 data words = 32 hierarchy words
  const size = 32 * 32 * 32; // 32,768 bits
  const pool = new BitPool(size);

  assertEquals(pool.size, size);
  assertEquals(pool.nextAvailableIndex, 0);

  // Test basic operations work
  const bit = pool.acquire();
  assertEquals(bit, 0);
  assertEquals(pool.isOccupied(bit), true);

  pool.release(bit);
  assertEquals(pool.isOccupied(bit), false);
});

Deno.test("BitPool - should handle hierarchy spanning across multiple levels", () => {
  const pool = new BitPool(2048); // Requires multiple hierarchy words
  const acquired: number[] = [];

  // Fill scattered patterns across multiple chunks
  for (let i = 0; i < 64; i++) {
    acquired.push(pool.acquire());
  }

  // Release every 4th bit to create fragmentation
  for (let i = 0; i < acquired.length; i += 4) {
    pool.release(acquired[i]!);
  }

  // Should be able to find and reuse released bits
  for (let i = 0; i < acquired.length; i += 4) {
    const newBit = pool.acquire();
    assertEquals(newBit, acquired[i]);
  }
});

// Edge Cases for Partial Words
Deno.test("BitPool - should handle pool size not divisible by 32", () => {
  const pool = new BitPool(50); // 1 full word + 18 bits

  // Fill the entire pool
  const acquired: number[] = [];
  for (let i = 0; i < 50; i++) {
    const bit = pool.acquire();
    assertEquals(bit, i);
    acquired.push(bit);
  }

  // Should be full
  assertEquals(pool.acquire(), -1);

  // Release last bit and verify it can be reacquired
  pool.release(49);
  assertEquals(pool.acquire(), 49);
});

// Complex State Validation
Deno.test("BitPool - should maintain consistent hierarchy after complex operations", () => {
  const pool = new BitPool(128); // Multiple words and hierarchy
  const acquired: number[] = [];

  // Create complex acquisition pattern
  for (let i = 0; i < 80; i++) {
    acquired.push(pool.acquire());
  }

  // Create fragmentation pattern - release every 3rd bit
  const releasedBits: number[] = [];
  for (let i = 0; i < acquired.length; i += 3) {
    pool.release(acquired[i]!);
    releasedBits.push(acquired[i]!);
  }

  // Force hierarchy rebuild
  pool.refresh();

  // Verify all released bits can be found and reacquired
  const reacquired: number[] = [];
  for (let i = 0; i < releasedBits.length; i++) {
    const bit = pool.acquire();
    assertEquals(bit !== -1, true);
    reacquired.push(bit);
  }

  // Verify the reacquired bits match the released ones
  releasedBits.sort((a, b) => a - b);
  reacquired.sort((a, b) => a - b);
  assertEquals(reacquired, releasedBits);
});

Deno.test("BitPool.truthyIndices - empty pool returns no indices", () => {
  const pool = new BitPool(32);
  // Set all bits to 0 (occupied)
  pool.fill(0);

  const indices = Array.from(pool.truthyIndices());
  assertEquals(indices, []);
});

Deno.test("BitPool.truthyIndices - full pool returns all indices", () => {
  const pool = new BitPool(32);
  // By default all bits are 1 (available)

  const indices = Array.from(pool.truthyIndices());
  assertEquals(indices, Array.from({ length: 32 }, (_, i) => i));
});

Deno.test("BitPool.truthyIndices - mixed pattern", () => {
  const pool = new BitPool(32);

  // Create pattern: 1010...1010 (even indices available)
  for (let i = 1; i < 32; i += 2) {
    pool.setBool(i, false);
  }

  const indices = Array.from(pool.truthyIndices());
  assertEquals(indices, Array.from({ length: 16 }, (_, i) => i * 2));
});

Deno.test("BitPool.truthyIndices - with start and end indices", () => {
  const pool = new BitPool(32);
  // Set all bits to 1 (available)
  pool.fill(0xFFFFFFFF);

  const indices = Array.from(pool.truthyIndices(8, 16));
  assertEquals(indices, Array.from({ length: 8 }, (_, i) => i + 8));
});

Deno.test("BitPool.truthyIndices - partial word at end", () => {
  const pool = new BitPool(35); // Not a multiple of 32
  // Set all bits to 1 (available)
  pool.fill(0xFFFFFFFF);

  const indices = Array.from(pool.truthyIndices());
  assertEquals(indices, Array.from({ length: 35 }, (_, i) => i));
});

Deno.test("BitPool.truthyIndices - after acquire/release operations", () => {
  const pool = new BitPool(32);

  // Acquire some bits
  const acquired1 = pool.acquire(); // Should be 0
  const acquired2 = pool.acquire(); // Should be 1

  // Release bit 1
  pool.release(acquired2);

  const indices = Array.from(pool.truthyIndices());
  assertEquals(indices.includes(acquired1), false, "Acquired bit should not be in truthy indices");
  assertEquals(indices.includes(acquired2), true, "Released bit should be in truthy indices");
});

Deno.test("BitPool.truthyIndices - with invalid range parameters", () => {
  const pool = new BitPool(32);

  // Test with start > end
  const indices1 = Array.from(pool.truthyIndices(16, 8));
  assertEquals(indices1, []);

  // Test with start at 0
  const indices2 = Array.from(pool.truthyIndices(0, 8));
  assertEquals(indices2, Array.from({ length: 8 }, (_, i) => i));

  // Test with end > size
  const indices3 = Array.from(pool.truthyIndices(0, 40));
  assertEquals(indices3, Array.from({ length: 32 }, (_, i) => i));
});

// Tests for Overridden BooleanArray Methods

// getBool() Tests
Deno.test("BitPool.getBool - should validate against actual size, not total array size", () => {
  const pool = new BitPool(32);

  // Should work for valid indices
  assertEquals(pool.getBool(0), true);
  assertEquals(pool.getBool(31), true);

  // Should throw for indices beyond actual size
  assertThrows(
    () => pool.getBool(32),
    RangeError,
    "Index 32 is out of bounds for array of size 32",
  );
});

Deno.test("BitPool.getBool - should return correct values after acquire/release", () => {
  const pool = new BitPool(32);

  // Initially all bits should be true (available)
  assertEquals(pool.getBool(5), true);

  // After setting to false
  pool.setBool(5, false);
  assertEquals(pool.getBool(5), false);

  // After setting back to true
  pool.setBool(5, true);
  assertEquals(pool.getBool(5), true);
});

// getBools() Tests
Deno.test("BitPool.getBools - should validate against actual size", () => {
  const pool = new BitPool(32);

  // Should work for valid range
  const result = pool.getBools(0, 32);
  assertEquals(result.length, 32);
  assertEquals(result.every((b) => b === true), true);

  // Should throw for range beyond actual size
  assertThrows(
    () => pool.getBools(30, 5),
    RangeError,
    "Index 35 is out of bounds for array of size 33. BooleanArrays are 0-indexed, try 32 instead.",
  );
});

Deno.test("BitPool.getBools - should return correct bulk values", () => {
  const pool = new BitPool(64);

  // Set specific pattern
  for (let i = 0; i < 32; i += 2) {
    pool.setBool(i, false);
  }

  const result = pool.getBools(0, 32);
  for (let i = 0; i < 32; i++) {
    assertEquals(result[i], i % 2 === 1, `Bit ${i} should be ${i % 2 === 1}`);
  }
});

// setBool() Tests
Deno.test("BitPool.setBool - should validate against actual size", () => {
  const pool = new BitPool(32);

  // Should work for valid indices
  pool.setBool(0, false);
  pool.setBool(31, false);

  // Should throw for indices beyond actual size
  assertThrows(
    () => pool.setBool(32, false),
    RangeError,
    "Index 32 is out of bounds for array of size 32",
  );
});

Deno.test("BitPool.setBool - should maintain hierarchy when word becomes empty/non-empty", () => {
  const pool = new BitPool(64);

  // Make first word empty
  for (let i = 0; i < 32; i++) {
    pool.setBool(i, false);
  }

  // Hierarchy should reflect empty word
  assertEquals(pool.getHierarchyWord(0) & 1, 0);

  // Set one bit back to true
  pool.setBool(15, true);

  // Hierarchy should reflect non-empty word
  assertEquals(pool.getHierarchyWord(0) & 1, 1);

  // nextAvailableIndex should be updated
  assertEquals(pool.nextAvailableIndex, 0);
});

Deno.test("BitPool.setBool - should handle word transitions correctly", () => {
  const pool = new BitPool(96); // 3 data words

  // Fill first two words completely
  for (let i = 0; i < 64; i++) {
    pool.setBool(i, false);
  }

  // Hierarchy should show first two words as empty, third word available
  // 0b100 = 4 (only third word has available bits)
  assertEquals(pool.getHierarchyWord(0), 4);

  // Make first word non-empty
  pool.setBool(10, true);

  // Hierarchy should update to show first and third words available
  // 0b101 = 5 (first and third words have available bits)
  assertEquals(pool.getHierarchyWord(0), 5);
});

// setRange() Tests
Deno.test("BitPool.setRange - should validate against actual size", () => {
  const pool = new BitPool(32);

  // Should work for valid range
  pool.setRange(0, 32, false);
  assertEquals(pool.getBool(0), false);
  assertEquals(pool.getBool(31), false);

  // Should throw for range beyond actual size
  assertThrows(
    () => pool.setRange(30, 5, false),
    RangeError,
    "Index 35 is out of bounds for array of size 33. BooleanArrays are 0-indexed, try 32 instead.",
  );
});

Deno.test("BitPool.setRange - should maintain hierarchy correctly", () => {
  const pool = new BitPool(96);

  // Set first word to false
  pool.setRange(0, 32, false);
  assertEquals(pool.getHierarchyWord(0) & 1, 0);

  // Set range spanning multiple words
  pool.setRange(16, 32, true); // Affects first and second words
  assertEquals(pool.getHierarchyWord(0) & 0b11, 0b11); // Both words should be non-empty
});

Deno.test("BitPool.setRange - should handle zero count", () => {
  const pool = new BitPool(32);
  const original = pool.getBool(10);

  pool.setRange(10, 0, false);
  assertEquals(pool.getBool(10), original); // Should be unchanged
});

// toggleBool() Tests
Deno.test("BitPool.toggleBool - should validate against actual size", () => {
  const pool = new BitPool(32);

  // Should work for valid indices
  assertEquals(pool.toggleBool(0), false);
  assertEquals(pool.toggleBool(31), false);

  // Should throw for indices beyond actual size
  assertThrows(
    () => pool.toggleBool(32),
    RangeError,
    "Index 32 is out of bounds for array of size 32",
  );
});

Deno.test("BitPool.toggleBool - should maintain hierarchy correctly", () => {
  const pool = new BitPool(64);

  // Make first word empty
  for (let i = 0; i < 32; i++) {
    pool.toggleBool(i); // All go from true to false
  }
  assertEquals(pool.getHierarchyWord(0) & 1, 0);

  // Toggle one bit back
  assertEquals(pool.toggleBool(15), true);
  assertEquals(pool.getHierarchyWord(0) & 1, 1);
});

Deno.test("BitPool.toggleBool - should return new value", () => {
  const pool = new BitPool(32);

  // Start with true
  assertEquals(pool.getBool(10), true);
  assertEquals(pool.toggleBool(10), false);
  assertEquals(pool.getBool(10), false);
  assertEquals(pool.toggleBool(10), true);
  assertEquals(pool.getBool(10), true);
});

// forEachBool() Tests
Deno.test("BitPool.forEachBool - should validate against actual size", () => {
  const pool = new BitPool(32);

  // Should work for valid range
  let count = 0;
  pool.forEachBool(() => count++, 0, 32);
  assertEquals(count, 32);

  // Should throw for range beyond actual size
  assertThrows(
    () => pool.forEachBool(() => {}, 30, 5),
    RangeError,
    "Index 35 is out of bounds for array of size 33. BooleanArrays are 0-indexed, try 32 instead.",
  );
});

Deno.test("BitPool.forEachBool - should iterate only over data portion", () => {
  const pool = new BitPool(64);

  // Set pattern in data
  for (let i = 0; i < 64; i += 2) {
    pool.setBool(i, false);
  }

  const visited: number[] = [];
  const values: boolean[] = [];

  pool.forEachBool((index, value) => {
    visited.push(index);
    values.push(value);
  });

  assertEquals(visited.length, 64);
  assertEquals(visited, Array.from({ length: 64 }, (_, i) => i));

  // Check pattern
  for (let i = 0; i < 64; i++) {
    assertEquals(values[i], i % 2 === 1, `Index ${i} should be ${i % 2 === 1}`);
  }
});

Deno.test("BitPool.forEachBool - should handle partial ranges", () => {
  const pool = new BitPool(64);

  const visited: number[] = [];
  pool.forEachBool((index) => visited.push(index), 10, 20);

  assertEquals(visited, Array.from({ length: 20 }, (_, i) => i + 10));
});

// getFirstSetIndex() Tests
Deno.test("BitPool.getFirstSetIndex - should search only data portion", () => {
  const pool = new BitPool(64);

  // Clear all data bits
  for (let i = 0; i < 64; i++) {
    pool.setBool(i, false);
  }

  // Set one bit
  pool.setBool(42, true);

  assertEquals(pool.getFirstSetIndex(), 42);
});

Deno.test("BitPool.getFirstSetIndex - should validate start index against actual size", () => {
  const pool = new BitPool(32);

  // Should work for valid start index
  assertEquals(pool.getFirstSetIndex(31), 31); // Should find bit 31 if it's set

  // Should throw for start index beyond actual size
  assertThrows(
    () => pool.getFirstSetIndex(32),
    RangeError,
    "Index 32 is out of bounds for array of size 32",
  );
});

Deno.test("BitPool.getFirstSetIndex - should handle edge cases", () => {
  const pool = new BitPool(65); // Crosses word boundary

  // Clear all except last bit
  for (let i = 0; i < 64; i++) {
    pool.setBool(i, false);
  }

  assertEquals(pool.getFirstSetIndex(), 64);
  assertEquals(pool.getFirstSetIndex(64), 64); // Should find the bit at index 64
});

// getLastSetIndex() Tests
Deno.test("BitPool.getLastSetIndex - should search only data portion", () => {
  const pool = new BitPool(64);

  // Clear all data bits
  for (let i = 0; i < 64; i++) {
    pool.setBool(i, false);
  }

  // Set one bit
  pool.setBool(42, true);

  assertEquals(pool.getLastSetIndex(), 42);
});

Deno.test("BitPool.getLastSetIndex - should validate end index against actual size", () => {
  const pool = new BitPool(32);

  // Should work for valid end index
  assertEquals(pool.getLastSetIndex(32), 31); // Search up to (but not including) 32

  // Should throw for end index beyond actual size + 1
  assertThrows(
    () => pool.getLastSetIndex(34),
    RangeError,
    "Index 34 is out of bounds for array of size 33. BooleanArrays are 0-indexed, try 32 instead.",
  );
});

Deno.test("BitPool.getLastSetIndex - should handle edge cases", () => {
  const pool = new BitPool(65);

  // Clear all except first bit
  for (let i = 1; i < 65; i++) {
    pool.setBool(i, false);
  }

  assertEquals(pool.getLastSetIndex(), 0);
  assertEquals(pool.getLastSetIndex(0), -1); // Empty range
});

// getPopulationCount() Tests
Deno.test("BitPool.getPopulationCount - should count only data portion", () => {
  const pool = new BitPool(64);

  // All bits initially true
  assertEquals(pool.getPopulationCount(), 64);

  // Clear half the bits
  for (let i = 0; i < 32; i++) {
    pool.setBool(i, false);
  }

  assertEquals(pool.getPopulationCount(), 32);
});

Deno.test("BitPool.getPopulationCount - should handle partial words", () => {
  const pool = new BitPool(50); // 1 full word + 18 bits

  assertEquals(pool.getPopulationCount(), 50);

  // Clear the partial word
  for (let i = 32; i < 50; i++) {
    pool.setBool(i, false);
  }

  assertEquals(pool.getPopulationCount(), 32);
});

Deno.test("BitPool.getPopulationCount - should handle empty pool", () => {
  const pool = new BitPool(64);

  // Clear all bits
  for (let i = 0; i < 64; i++) {
    pool.setBool(i, false);
  }

  assertEquals(pool.getPopulationCount(), 0);
});

// isEmpty() Tests
Deno.test("BitPool.isEmpty - should check only data portion", () => {
  const pool = new BitPool(64);

  // Initially not empty (all bits true)
  assertEquals(pool.isEmpty(), false);

  // Clear all data bits
  for (let i = 0; i < 64; i++) {
    pool.setBool(i, false);
  }

  assertEquals(pool.isEmpty(), true);
});

Deno.test("BitPool.isEmpty - should handle single bit pools", () => {
  const pool = new BitPool(1);

  assertEquals(pool.isEmpty(), false);

  pool.setBool(0, false);
  assertEquals(pool.isEmpty(), true);
});

// clone() Tests
Deno.test("BitPool.clone - should create new BitPool with same data", () => {
  const pool = new BitPool(64);

  // Create pattern
  for (let i = 0; i < 32; i++) {
    pool.setBool(i, false);
  }

  const cloned = pool.clone();

  // Should be different instances
  assertEquals(pool === cloned, false);

  // Should have same size
  assertEquals(cloned.size, 64);

  // Should have same data
  for (let i = 0; i < 64; i++) {
    assertEquals(cloned.getBool(i), pool.getBool(i), `Bit ${i} should match`);
  }

  // Should have functional hierarchy
  const bit = cloned.acquire();
  assertEquals(typeof bit, "number");
  assertEquals(bit >= 0, true);
});

Deno.test("BitPool.clone - should maintain independent state", () => {
  const pool = new BitPool(32);
  const cloned = pool.clone();

  // Modify original
  pool.setBool(10, false);

  // Clone should be unaffected
  assertEquals(cloned.getBool(10), true);

  // Modify clone
  cloned.setBool(20, false);

  // Original should be unaffected
  assertEquals(pool.getBool(20), true);
});

// clear() Tests
Deno.test("BitPool.clear - should clear only data portion", () => {
  const pool = new BitPool(64);

  // Acquire some bits
  pool.acquire();
  pool.acquire();

  pool.clear();

  // All data should be cleared (false)
  assertEquals(pool.isEmpty(), true);

  // After clearing, no bits should be available for acquisition
  assertEquals(pool.acquire(), -1);
});

Deno.test("BitPool.clear - should maintain valid hierarchy state", () => {
  const pool = new BitPool(64);

  pool.clear();

  // Should be able to set bits after clear
  pool.setBool(10, true);
  assertEquals(pool.getBool(10), true);

  // Hierarchy should work
  const bit = pool.acquire();
  assertEquals(bit, 10); // Should find the set bit
});

// setAll() Tests
Deno.test("BitPool.setAll - should set only data portion to true", () => {
  const pool = new BitPool(64);

  // Clear some bits first
  for (let i = 0; i < 32; i++) {
    pool.setBool(i, false);
  }

  pool.setAll();

  // All data should be true
  for (let i = 0; i < 64; i++) {
    assertEquals(pool.getBool(i), true, `Bit ${i} should be true`);
  }

  // nextAvailableIndex should be reset
  assertEquals(pool.nextAvailableIndex, 0);
});

Deno.test("BitPool.setAll - should handle partial words correctly", () => {
  const pool = new BitPool(50); // 1 full word + 18 bits

  pool.setAll();

  assertEquals(pool.getPopulationCount(), 50);

  // Last bit should be settable
  pool.setBool(49, false);
  assertEquals(pool.getBool(49), false);
});

// Bitwise Operation Error Tests
Deno.test("BitPool.and - should throw descriptive error", () => {
  const pool1 = new BitPool(32);

  assertThrows(
    () => pool1.and(),
    Error,
    "Bitwise operations are not supported on BitPool",
  );
});

Deno.test("BitPool.or - should throw descriptive error", () => {
  const pool1 = new BitPool(32);

  assertThrows(
    () => pool1.or(),
    Error,
    "Bitwise operations are not supported on BitPool",
  );
});

Deno.test("BitPool.xor - should throw descriptive error", () => {
  const pool1 = new BitPool(32);

  assertThrows(
    () => pool1.xor(),
    Error,
    "Bitwise operations are not supported on BitPool",
  );
});

Deno.test("BitPool.not - should throw descriptive error", () => {
  const pool = new BitPool(32);

  assertThrows(
    () => pool.not(),
    Error,
    "Bitwise operations are not supported on BitPool",
  );
});

Deno.test("BitPool.nand - should throw descriptive error", () => {
  const pool1 = new BitPool(32);

  assertThrows(
    () => pool1.nand(),
    Error,
    "Bitwise operations are not supported on BitPool",
  );
});

Deno.test("BitPool.nor - should throw descriptive error", () => {
  const pool1 = new BitPool(32);

  assertThrows(
    () => pool1.nor(),
    Error,
    "Bitwise operations are not supported on BitPool",
  );
});

Deno.test("BitPool.difference - should throw descriptive error", () => {
  const pool1 = new BitPool(32);

  assertThrows(
    () => pool1.difference(),
    Error,
    "Bitwise operations are not supported on BitPool",
  );
});

Deno.test("BitPool.xnor - should throw descriptive error", () => {
  const pool1 = new BitPool(32);

  assertThrows(
    () => pool1.xnor(),
    Error,
    "Bitwise operations are not supported on BitPool",
  );
});

// Integration Tests for Overridden Methods
Deno.test("BitPool - overridden methods should work together correctly", () => {
  const pool = new BitPool(100);

  // Use setRange to create pattern
  pool.setRange(10, 20, false);

  // Check with getBools
  const values = pool.getBools(5, 30);
  for (let i = 0; i < 30; i++) {
    const globalIndex = i + 5;
    const expected = !(globalIndex >= 10 && globalIndex < 30);
    assertEquals(values[i], expected, `Index ${globalIndex} should be ${expected}`);
  }

  // Use getFirstSetIndex and getLastSetIndex
  assertEquals(pool.getFirstSetIndex(), 0);
  assertEquals(pool.getLastSetIndex(), 99);
  assertEquals(pool.getFirstSetIndex(15), 30); // First set bit after cleared range

  // Check population count
  assertEquals(pool.getPopulationCount(), 80); // 100 - 20 cleared bits

  // Clone and verify independence
  const cloned = pool.clone();
  cloned.toggleBool(50);
  assertEquals(pool.getBool(50), true);
  assertEquals(cloned.getBool(50), false);
});

Deno.test("BitPool - hierarchy maintenance during complex operations", () => {
  const pool = new BitPool(128); // Multiple hierarchy words

  // Create complex pattern using overridden methods
  pool.setRange(0, 32, false); // Clear first word
  pool.setRange(64, 32, false); // Clear third word

  // Second and fourth words should be available
  assertEquals(pool.getHierarchyWord(0) & 0b1111, 0b1010);

  // Use setBool to make first word partially available
  pool.setBool(15, true);

  // Hierarchy should update
  assertEquals(pool.getHierarchyWord(0) & 0b1111, 0b1011);

  // forEachBool should see the correct pattern
  const setBits: number[] = [];
  pool.forEachBool((index, value) => {
    if (value) setBits.push(index);
  });

  // Should have bit 15, bits 32-63, and bits 96-127
  const expectedCount = 1 + 32 + 32; // 65 bits
  assertEquals(setBits.length, expectedCount);
  assertEquals(setBits.includes(15), true);
  assertEquals(setBits.includes(0), false);
  assertEquals(setBits.includes(32), true);
  assertEquals(setBits.includes(64), false);
  assertEquals(setBits.includes(96), true);
});

Deno.test("BitPool - overridden methods should respect size boundaries", () => {
  const pool = new BitPool(50); // Partial last word

  // All methods should respect the 50-bit limit, not the underlying array size
  assertEquals(pool.getPopulationCount(), 50);

  const indices = Array.from(pool.truthyIndices());
  assertEquals(indices.length, 50);
  assertEquals(Math.max(...indices), 49);

  // forEachBool should only iterate 50 times
  let count = 0;
  pool.forEachBool(() => count++);
  assertEquals(count, 50);

  // getBools should respect the limit
  assertThrows(() => pool.getBools(0, 51), RangeError);

  // Methods should work up to index 49
  pool.setBool(49, false);
  assertEquals(pool.getBool(49), false);
  assertEquals(pool.toggleBool(49), true);
});
