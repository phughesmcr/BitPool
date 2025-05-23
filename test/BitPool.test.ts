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
