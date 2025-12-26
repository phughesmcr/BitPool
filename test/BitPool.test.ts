/// <reference lib="deno.ns" />
/// <reference lib="dom" />

// deno-lint-ignore no-import-prefix
import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.9";
import { BitPool } from "../mod.ts";

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

Deno.test("BitPool - constructor should throw TypeError for float size", () => {
  assertThrows(
    () => new BitPool(1.5),
    TypeError,
    '"value" must be a safe integer',
  );
});

Deno.test("BitPool - constructor should throw TypeError for Infinity size", () => {
  assertThrows(
    () => new BitPool(Infinity),
    TypeError,
    '"value" must be a safe integer',
  );
});

Deno.test("BitPool - constructor should throw RangeError for negative size", () => {
  assertThrows(
    () => new BitPool(-1),
    RangeError,
    '"size" must be greater than 0',
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
  assertEquals(pool.nextAvailableIndex, lastBit); // Should point to the released bit
});

Deno.test("BitPool - release of same index twice should be no-op on second release", () => {
  const pool = new BitPool(8);
  const bit = pool.acquire();
  const countAfterAcquire = pool.availableCount;

  pool.release(bit);
  const countAfterFirstRelease = pool.availableCount;
  const nextAfterFirstRelease = pool.nextAvailableIndex;

  pool.release(bit); // Second release
  assertEquals(pool.availableCount, countAfterFirstRelease); // No change
  assertEquals(pool.nextAvailableIndex, nextAfterFirstRelease); // No change
  assertEquals(countAfterFirstRelease, countAfterAcquire + 1);
});

Deno.test("BitPool - release of non-integer should be ignored", () => {
  const pool = new BitPool(8);
  pool.acquire();
  const countBefore = pool.availableCount;

  pool.release(1.2); // Non-integer
  assertEquals(pool.availableCount, countBefore); // Unchanged
});

// Complex Scenarios
Deno.test("BitPool - should handle acquire-release-acquire pattern", () => {
  const pool = new BitPool(8);
  const bit1 = pool.acquire();
  const bit2 = pool.acquire(); // Acquire second bit to move nextAvailableIndex
  assertEquals(bit2, bit1 + 1); // Verify sequential allocation
  pool.release(bit1);
  assertEquals(pool.acquire(), bit1); // Should reuse the released bit
});

Deno.test("BitPool - should handle multiple releases", () => {
  const pool = new BitPool(8);
  const bits = Array.from({ length: 8 }, () => pool.acquire());
  bits.forEach((bit) => pool.release(bit));
  assertEquals(pool.nextAvailableIndex, 7);
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
  assertEquals(newBit1, bits[3]);
});

Deno.test("BitPool - should handle floating point inputs", () => {
  const pool = new BitPool(8);
  const bit = pool.acquire();

  // Ignore non-integer indices; NaN should throw
  pool.release(1.5); // Ignored (not a safe integer)
  pool.release(-0.5); // Ignored (not a safe integer)

  // NaN should throw
  assertThrows(
    () => pool.release(NaN),
    TypeError,
    '"index" must be a number',
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
  assertEquals(pool.nextAvailableIndex < pool.size, true);
});

// fromArray Static Method Tests
Deno.test("BitPool.fromArray - should create BitPool from valid array", () => {
  const arr = [0b11110000];
  const pool = BitPool.fromArray(256, arr);

  // Check first byte (inverted)
  assertEquals(pool.isOccupied(0), true);
  assertEquals(pool.isOccupied(1), true);
  assertEquals(pool.isOccupied(2), true);
  assertEquals(pool.isOccupied(3), true);
  assertEquals(pool.isOccupied(4), false);
  assertEquals(pool.isOccupied(5), false);
  assertEquals(pool.isOccupied(6), false);
});

Deno.test("BitPool.fromArray - should handle empty array", () => {
  const pool = BitPool.fromArray(32, []);
  assertEquals(pool.size, 32);
  assertEquals(pool.nextAvailableIndex, 0);
});

Deno.test("BitPool.fromArray - should handle multiple integers", () => {
  const arr = [0b11110000, 0b00001111];
  const pool = BitPool.fromArray(512, arr);

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
    () => BitPool.fromArray(31, arr),
    RangeError,
    'For the array to fit, "capacity" must be greater than or equal to 64',
  );
});

Deno.test("BitPool.fromArray - should handle array with all bits set", () => {
  const arr = [0xFFFFFFFF];
  const pool = BitPool.fromArray(32, arr);

  // All bits should be available (not occupied)
  for (let i = 0; i < 32; i++) {
    assertEquals(pool.isOccupied(i), false);
  }
});

Deno.test("BitPool.fromArray - should handle array with no bits set", () => {
  const arr = [0x00000000];
  const pool = BitPool.fromArray(32, arr);

  // All bits should be occupied
  for (let i = 0; i < 32; i++) {
    assertEquals(pool.isOccupied(i), true);
  }
});

Deno.test("BitPool.fromArray - should handle capacity larger than needed", () => {
  const arr = [0b11110000];
  const pool = BitPool.fromArray(256, arr);

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
  const pool = BitPool.fromArray(64, arr);
  assertEquals(pool.nextAvailableIndex, 4); // First available bit after the occupied bits 0-3
});

Deno.test("BitPool.fromArray - should throw for invalid array values", () => {
  assertThrows(
    () => BitPool.fromArray(32, [NaN]),
    TypeError,
    '"value" must be a safe integer',
  );

  assertThrows(
    () => BitPool.fromArray(32, [Infinity]),
    TypeError,
    '"value" must be a safe integer',
  );

  assertThrows(
    () => BitPool.fromArray(32, [-1]),
    RangeError,
    '"value" must be greater than or equal to 0',
  );
});

Deno.test("BitPool.fromArray - should handle maximum valid capacity", () => {
  const arr = [0b11110000];
  const pool = BitPool.fromArray(BitPool.MAX_SAFE_SIZE, arr);
  assertEquals(pool.size, BitPool.MAX_SAFE_SIZE);
});

Deno.test("BitPool.fromArray - should throw for invalid capacity", () => {
  const arr = [0b11110000];
  assertThrows(
    () => BitPool.fromArray(0, arr),
    RangeError,
    '"capacity" must be greater than 0',
  );

  assertThrows(
    () => BitPool.fromArray(-1, arr),
    RangeError,
    '"capacity" must be greater than 0',
  );

  assertThrows(
    () => BitPool.fromArray(0x100000000, arr),
    RangeError,
    '"value" must be smaller than or equal to 536870911',
  );
});

Deno.test("BitPool.fromArray - should accept boolean arrays", () => {
  // Note: fromArray converts booleans to 0xFFFFFFFF (true) or 0x00000000 (false)
  // But current implementation treats them as numbers, so we use number arrays
  // This test documents the expected behavior once boolean support is added
  const arr = [0xFFFFFFFF, 0xFFFFFFFF, 0x00000000, 0x00000000];
  const pool = BitPool.fromArray(256, arr);

  // After inversion: 0xFFFFFFFF->0x00000000 (all occupied), 0x00000000->0xFFFFFFFF (all available)
  // First 32 bits should be available
  for (let i = 0; i < 32; i++) {
    assertEquals(pool.isOccupied(i), false);
  }
  // Next 32 bits should be available
  for (let i = 32; i < 64; i++) {
    assertEquals(pool.isOccupied(i), false);
  }
  // Bits 64-95 should be occupied
  for (let i = 64; i < 96; i++) {
    assertEquals(pool.isOccupied(i), true);
  }
});

Deno.test("BitPool.fromArray - should throw for non-array input", () => {
  assertThrows(
    // @ts-expect-error - intentionally testing invalid input
    () => BitPool.fromArray(32, null),
    TypeError,
    '"arr" must be an array-like of numbers.',
  );

  assertThrows(
    // @ts-expect-error - intentionally testing invalid input
    () => BitPool.fromArray(32, "not an array"),
    TypeError,
    '"arr" must be an array-like of numbers.',
  );
});

Deno.test("BitPool.fromArray - should handle all 1s (all available after inversion)", () => {
  const arr = [0xFFFFFFFF];
  const pool = BitPool.fromArray(32, arr);
  assertEquals(pool.nextAvailableIndex, 0);
  assertEquals(pool.availableCount, 32);
});

Deno.test("BitPool.fromArray - should handle all 0s (all occupied after inversion)", () => {
  const arr = [0x00000000];
  const pool = BitPool.fromArray(32, arr);
  assertEquals(pool.nextAvailableIndex, -1);
  assertEquals(pool.availableCount, 0);
});

Deno.test("BitPool.fromArray - should handle capacity exactly matching array size", () => {
  const arr = [0b11110000, 0b00001111];
  const pool = BitPool.fromArray(64, arr); // Exactly 2 * 32
  assertEquals(pool.size, 64);
  // Verify first word pattern
  assertEquals(pool.isOccupied(0), true);
  assertEquals(pool.isOccupied(4), false);
});

// refresh() Method Tests
Deno.test("BitPool - refresh should work without parameters", () => {
  const pool = new BitPool(32);
  const bit1 = pool.acquire();
  pool.acquire(); // Just acquire without storing
  pool.release(bit1);
  pool.refresh();
  assertEquals(pool.nextAvailableIndex, 0); // Should find the released bit
});

Deno.test("BitPool - refresh should set nextAvailableIndex to first available", () => {
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
  pool.refresh();
  assertEquals(pool.nextAvailableIndex, 32); // Should point to first available bit in second chunk
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

// isOccupied() Error Handling Tests
Deno.test("BitPool - isOccupied should throw TypeError for non-number input", () => {
  const pool = new BitPool(32);

  assertThrows(
    // @ts-expect-error - intentionally testing invalid input
    () => pool.isOccupied("0"),
    TypeError,
    '"index" must be a number',
  );

  assertThrows(
    // @ts-expect-error - intentionally testing invalid input
    () => pool.isOccupied(null),
    TypeError,
    '"index" must be a number',
  );

  assertThrows(
    () => pool.isOccupied(NaN),
    TypeError,
    '"index" must be a number',
  );
});

// MAX_SAFE_SIZE Tests
Deno.test("BitPool - MAX_SAFE_SIZE should return a valid number", () => {
  const maxSize = BitPool.MAX_SAFE_SIZE;
  assertEquals(typeof maxSize, "number");
  assertEquals(maxSize > 0, true);
  assertEquals(Number.isSafeInteger(maxSize), true);
});

Deno.test("BitPool - should be able to create pool at MAX_SAFE_SIZE", () => {
  const maxSize = BitPool.MAX_SAFE_SIZE;
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

Deno.test("BitPool.availableIndices - empty pool returns no indices", () => {
  const pool = new BitPool(32);
  pool.fill();
  const indices = Array.from(pool.availableIndices());
  assertEquals(indices, []);
});

Deno.test("BitPool.availableIndices - full pool returns all indices", () => {
  const pool = new BitPool(32);
  // By default all bits are 1 (available)
  const indices = Array.from(pool.availableIndices());
  assertEquals(indices, Array.from({ length: 32 }, (_, i) => i));
});

Deno.test("BitPool.availableIndices - after acquire/release operations", () => {
  const pool = new BitPool(32);

  // Acquire some bits
  const acquired1 = pool.acquire(); // Should be 0
  const acquired2 = pool.acquire(); // Should be 1

  // Release bit 1
  pool.release(acquired2);

  const indices = Array.from(pool.availableIndices());
  assertEquals(indices.includes(acquired1), false, "Acquired bit should not be in truthy indices");
  assertEquals(indices.includes(acquired2), true, "Released bit should be in truthy indices");
});

Deno.test("BitPool.availableIndices - with invalid range parameters", () => {
  const pool = new BitPool(32);

  // Test with start > end
  const indices1 = Array.from(pool.availableIndices(16, 8));
  assertEquals(indices1, []);

  // Test with start at 0
  const indices2 = Array.from(pool.availableIndices(0, 8));
  assertEquals(indices2, Array.from({ length: 8 }, (_, i) => i));

  // Test with end > size
  const indices3 = Array.from(pool.availableIndices(0, 40));
  assertEquals(indices3, Array.from({ length: 32 }, (_, i) => i));
});

// fromUint32Array Static Method Tests
Deno.test("BitPool.fromUint32Array - should create BitPool from Uint32Array", () => {
  const arr = [0b11110000];
  const pool = BitPool.fromUint32Array(32, arr);

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

Deno.test("BitPool.fromUint32Array - should handle empty array", () => {
  const pool = BitPool.fromUint32Array(32, []);
  assertEquals(pool.size, 32);
  assertEquals(pool.availableCount, 32);
});

Deno.test("BitPool.fromUint32Array - should handle multiple words", () => {
  const arr = [0b11110000, 0b00001111];
  const pool = BitPool.fromUint32Array(64, arr);

  // First word
  assertEquals(pool.isOccupied(0), true);
  assertEquals(pool.isOccupied(4), false);

  // Second word
  assertEquals(pool.isOccupied(32), false);
  assertEquals(pool.isOccupied(36), true);
});

Deno.test("BitPool.fromUint32Array - should throw for invalid capacity", () => {
  assertThrows(
    () => BitPool.fromUint32Array(0, [0b11110000]),
    RangeError,
    '"capacity" must be greater than 0',
  );
});

Deno.test("BitPool.fromUint32Array - should throw for capacity too small", () => {
  assertThrows(
    () => BitPool.fromUint32Array(31, [0b11110000, 0b00001111]),
    RangeError,
    'For the array to fit, "capacity" must be greater than or equal to 64',
  );
});

Deno.test("BitPool.fromUint32Array - should accept Uint32Array typed array", () => {
  const typedArray = new Uint32Array([0b11110000, 0b00001111]);
  const pool = BitPool.fromUint32Array(64, typedArray);

  // First word
  assertEquals(pool.isOccupied(0), true);
  assertEquals(pool.isOccupied(4), false);

  // Second word
  assertEquals(pool.isOccupied(32), false);
  assertEquals(pool.isOccupied(36), true);
});

Deno.test("BitPool.fromUint32Array - should handle capacity exactly matching array size", () => {
  const arr = [0b11110000, 0b00001111];
  const pool = BitPool.fromUint32Array(64, arr); // Exactly 2 * 32
  assertEquals(pool.size, 64);
  assertEquals(pool.isOccupied(0), true);
  assertEquals(pool.isOccupied(4), false);
});

// Property Tests
Deno.test("BitPool - availableCount should return correct count", () => {
  const pool = new BitPool(32);
  assertEquals(pool.availableCount, 32);

  pool.acquire();
  assertEquals(pool.availableCount, 31);

  pool.acquire();
  assertEquals(pool.availableCount, 30);
});

Deno.test("BitPool - occupiedCount should return correct count", () => {
  const pool = new BitPool(32);
  assertEquals(pool.occupiedCount, 0);

  pool.acquire();
  assertEquals(pool.occupiedCount, 1);

  pool.acquire();
  assertEquals(pool.occupiedCount, 2);
});

Deno.test("BitPool - isEmpty should return correct state", () => {
  const pool = new BitPool(32);
  assertEquals(pool.isEmpty, true);

  pool.acquire();
  assertEquals(pool.isEmpty, false);

  pool.clear();
  assertEquals(pool.isEmpty, true);
});

Deno.test("BitPool - isFull should return correct state", () => {
  const pool = new BitPool(2);
  assertEquals(pool.isFull, false);

  pool.acquire();
  pool.acquire();
  assertEquals(pool.isFull, true);

  pool.clear();
  assertEquals(pool.isFull, false);
});

// Core Method Tests
Deno.test("BitPool - clear should make all indices available", () => {
  const pool = new BitPool(8);
  pool.acquire();
  pool.acquire();
  assertEquals(pool.availableCount, 6);

  pool.clear();
  assertEquals(pool.availableCount, 8);
  assertEquals(pool.nextAvailableIndex, 0);
});

Deno.test("BitPool - fill should make all indices occupied", () => {
  const pool = new BitPool(8);
  assertEquals(pool.availableCount, 8);

  pool.fill();
  assertEquals(pool.availableCount, 0);
  assertEquals(pool.nextAvailableIndex, -1);
});

Deno.test("BitPool - acquire after fill should return -1, release should update nextAvailableIndex", () => {
  const pool = new BitPool(8);
  pool.fill();

  assertEquals(pool.acquire(), -1); // Pool is full

  pool.release(3); // Release a valid index
  assertEquals(pool.nextAvailableIndex, 3);
  assertEquals(pool.acquire(), 3); // Should reacquire the released bit
});

Deno.test("BitPool - clone should create independent copy", () => {
  const pool = new BitPool(8);
  pool.acquire();
  pool.acquire();

  const cloned = pool.clone();
  assertEquals(cloned.size, pool.size);
  assertEquals(cloned.availableCount, pool.availableCount);

  // Verify independence
  pool.acquire();
  assertEquals(cloned.availableCount, pool.availableCount + 1);
});

Deno.test("BitPool - clone should have independent buffer (deep copy)", () => {
  const pool = new BitPool(64);
  pool.acquire(); // 0
  pool.acquire(); // 1

  const cloned = pool.clone();

  // Verify buffers are equal initially
  const poolValues = Array.from(pool);
  const clonedValues = Array.from(cloned);
  assertEquals(poolValues, clonedValues);

  // Mutate original
  pool.acquire(); // 2
  pool.acquire(); // 3

  // Verify buffers diverged
  const poolValuesAfter = Array.from(pool);
  const clonedValuesAfter = Array.from(cloned);
  assertEquals(poolValuesAfter[0] !== clonedValuesAfter[0], true, "Buffers should diverge after mutation");

  // Verify clone state unchanged
  assertEquals(cloned.occupiedCount, 2);
  assertEquals(cloned.isOccupied(0), true);
  assertEquals(cloned.isOccupied(1), true);
  assertEquals(cloned.isOccupied(2), false);
});

Deno.test("BitPool - isAvailable should return correct state", () => {
  const pool = new BitPool(8);
  assertEquals(pool.isAvailable(0), true);

  const bit = pool.acquire();
  assertEquals(pool.isAvailable(bit), false);

  pool.release(bit);
  assertEquals(pool.isAvailable(bit), true);
});

Deno.test("BitPool - isAvailable should throw TypeError for non-number input", () => {
  const pool = new BitPool(32);

  assertThrows(
    // @ts-expect-error - intentionally testing invalid input
    () => pool.isAvailable("0"),
    TypeError,
    '"index" must be a number',
  );

  assertThrows(
    // @ts-expect-error - intentionally testing invalid input
    () => pool.isAvailable(null),
    TypeError,
    '"index" must be a number',
  );

  assertThrows(
    () => pool.isAvailable(NaN),
    TypeError,
    '"index" must be a number',
  );
});

Deno.test("BitPool - isAvailable should throw RangeError for out of bounds", () => {
  const pool = new BitPool(32);

  assertThrows(
    () => pool.isAvailable(32),
    RangeError,
  );

  assertThrows(
    () => pool.isAvailable(-1),
    RangeError,
  );
});

Deno.test("BitPool - findNextAvailable should find next available index", () => {
  const pool = new BitPool(8);
  pool.acquire(); // 0
  pool.acquire(); // 1

  assertEquals(pool.findNextAvailable(0), 2); // Searches from 0+1=1, finds 2
  assertEquals(pool.findNextAvailable(1), 2); // Searches from 1+1=2, finds 2
  assertEquals(pool.findNextAvailable(2), 3); // Searches from 2+1=3, finds 3
});

Deno.test("BitPool - findNextAvailable with loop should wrap around", () => {
  const pool = new BitPool(4);
  pool.acquire(); // 0
  pool.acquire(); // 1
  pool.acquire(); // 2
  pool.acquire(); // 3
  pool.release(1); // Release middle bit

  assertEquals(pool.findNextAvailable(2, true), 1);
});

Deno.test("BitPool - findNextAvailable should return -1 when pool is full", () => {
  const pool = new BitPool(4);
  pool.fill();

  assertEquals(pool.findNextAvailable(0, false), -1);
  assertEquals(pool.findNextAvailable(0, true), -1);
});

Deno.test("BitPool - findNextAvailable with out of bounds startIndex should return first available", () => {
  const pool = new BitPool(8);
  pool.acquire(); // Occupy bit 0

  // Negative start index
  assertEquals(pool.findNextAvailable(-5), 1);

  // Start index beyond size
  assertEquals(pool.findNextAvailable(100), 1);
});

Deno.test("BitPool - findNextAvailable should handle holes in lower chunks with loop", () => {
  const pool = new BitPool(64);
  // Fill the entire pool
  for (let i = 0; i < 64; i++) {
    pool.acquire();
  }

  // Release bit 5 in first chunk
  pool.release(5);

  // Start searching from index 40 with loop enabled
  // Should search 41..63, find none, then loop back to 0 and find 5
  assertEquals(pool.findNextAvailable(40, true), 5);
});

// Iterator Tests
Deno.test("BitPool - Symbol.iterator should yield uint32 values", () => {
  const pool = new BitPool(64);
  pool.acquire(); // Occupy bit 0

  const values = Array.from(pool);
  assertEquals(values.length, 2); // 64 bits = 2 uint32 words
  assertEquals(typeof values[0], "number");
});

Deno.test("BitPool - Symbol.iterator length should match Math.ceil(size / 32)", () => {
  const testCases = [
    { size: 1, expected: 1 },
    { size: 33, expected: 2 },
    { size: 50, expected: 2 },
    { size: 64, expected: 2 },
    { size: 65, expected: 3 },
  ];

  for (const { size, expected } of testCases) {
    const pool = new BitPool(size);
    const values = Array.from(pool);
    assertEquals(values.length, expected, `Size ${size} should yield ${expected} words`);
  }
});

Deno.test("BitPool - Symbol.iterator should reflect occupied bits in bitmask", () => {
  const pool = new BitPool(32);

  // Acquire first 4 bits (0, 1, 2, 3)
  pool.acquire();
  pool.acquire();
  pool.acquire();
  pool.acquire();

  const values = Array.from(pool);
  // Bits 0-3 should be set (occupied = true = 1)
  // Lower 4 bits set: 0b1111 = 15
  assertEquals(values[0]! & 0b1111, 0b1111);
});

Deno.test("BitPool - occupiedIndices should yield occupied indices", () => {
  const pool = new BitPool(8);
  const bit1 = pool.acquire();
  const bit2 = pool.acquire();

  const occupied = Array.from(pool.occupiedIndices());
  assertEquals(occupied, [bit1, bit2]);
});

Deno.test("BitPool - occupiedIndices with range should respect bounds", () => {
  const pool = new BitPool(8);
  pool.acquire(); // 0
  pool.acquire(); // 1
  pool.acquire(); // 2

  const occupied = Array.from(pool.occupiedIndices(1, 3));
  assertEquals(occupied, [1, 2]);
});

Deno.test("BitPool - availableIndices with start < 0 should clamp to 0", () => {
  const pool = new BitPool(8);
  pool.acquire(); // 0

  const indices = Array.from(pool.availableIndices(-5, 3));
  assertEquals(indices, [1, 2]); // Bits 1-2 are available (0 is occupied, 3 is exclusive)
});

Deno.test("BitPool - availableIndices with end > size should clamp to size", () => {
  const pool = new BitPool(8);
  pool.acquire(); // 0

  const indices = Array.from(pool.availableIndices(6, 100));
  assertEquals(indices, [6, 7]); // Only bits 6-7 exist in range
});

Deno.test("BitPool - availableIndices with start == end should return empty", () => {
  const pool = new BitPool(8);

  const indices = Array.from(pool.availableIndices(3, 3));
  assertEquals(indices, []);
});

Deno.test("BitPool - availableIndices with start > end should return empty", () => {
  const pool = new BitPool(8);

  const indices = Array.from(pool.availableIndices(5, 3));
  assertEquals(indices, []);
});

Deno.test("BitPool - occupiedIndices with start < 0 should clamp to 0", () => {
  const pool = new BitPool(8);
  pool.acquire(); // 0
  pool.acquire(); // 1

  const indices = Array.from(pool.occupiedIndices(-5, 2));
  assertEquals(indices, [0, 1]);
});

Deno.test("BitPool - occupiedIndices with end > size should clamp to size", () => {
  const pool = new BitPool(8);
  pool.acquire(); // 0
  pool.acquire(); // 1

  const indices = Array.from(pool.occupiedIndices(0, 100));
  assertEquals(indices, [0, 1]); // Only these are occupied
});

Deno.test("BitPool - occupiedIndices with start == end should return empty", () => {
  const pool = new BitPool(8);
  pool.acquire();

  const indices = Array.from(pool.occupiedIndices(3, 3));
  assertEquals(indices, []);
});

Deno.test("BitPool - occupiedIndices with start > end should return empty", () => {
  const pool = new BitPool(8);
  pool.acquire();

  const indices = Array.from(pool.occupiedIndices(5, 3));
  assertEquals(indices, []);
});

// Multi-chunk Tests
Deno.test("BitPool - multi-chunk release in earlier chunk should update nextAvailableIndex", () => {
  const pool = new BitPool(2048);

  // Acquire across multiple chunks
  const acquired: number[] = [];
  for (let i = 0; i < 100; i++) {
    acquired.push(pool.acquire());
  }

  // Release a bit in an earlier chunk (e.g., bit 10)
  pool.release(10);

  // nextAvailableIndex should point to the released bit without refresh
  assertEquals(pool.nextAvailableIndex, 10);

  // Next acquire should get the released bit
  assertEquals(pool.acquire(), 10);
});

Deno.test("BitPool - multi-chunk operations should maintain consistency", () => {
  const pool = new BitPool(2048);

  // Fill first two chunks completely
  for (let i = 0; i < 64; i++) {
    pool.acquire();
  }

  // Release some bits in first chunk
  pool.release(5);
  pool.release(15);
  pool.release(25);

  // Verify nextAvailableIndex points to the last released
  assertEquals(pool.nextAvailableIndex, 25);

  // Next acquires get from nextAvailableIndex, then search forward
  assertEquals(pool.acquire(), 25); // Gets last released
  // After acquiring 25, findNextAvailable searches and finds next available
  const next = pool.acquire();
  assertEquals(next === 15 || next === 64, true); // Could be 15 or first in next chunk
});

// Deterministic Stress Tests
Deno.test("BitPool - deterministic LCG stress test with state invariants", () => {
  const pool = new BitPool(1024);

  // Simple LCG parameters (from Numerical Recipes)
  let seed = 12345;
  const lcg = () => {
    seed = (1103515245 * seed + 12345) % 2147483648;
    return seed;
  };

  const acquired = new Set<number>();

  // Phase 1: Acquire 512 bits
  for (let i = 0; i < 512; i++) {
    const bit = pool.acquire();
    if (bit !== -1) {
      acquired.add(bit);
    }
  }

  // Verify invariant
  assertEquals(pool.availableCount + pool.occupiedCount, pool.size);
  assertEquals(pool.occupiedCount, acquired.size);

  // Phase 2: Release half deterministically
  const toRelease = Array.from(acquired).filter((_, i) => i % 2 === 0);
  for (const bit of toRelease) {
    pool.release(bit);
    acquired.delete(bit);
  }

  // Verify invariant
  assertEquals(pool.availableCount + pool.occupiedCount, pool.size);
  assertEquals(pool.occupiedCount, acquired.size);

  // Phase 3: Random acquire/release based on LCG
  for (let i = 0; i < 1000; i++) {
    const rand = lcg() % 100;
    if (rand < 50 && acquired.size < pool.size) {
      // Acquire
      const bit = pool.acquire();
      if (bit !== -1) {
        acquired.add(bit);
      }
    } else if (acquired.size > 0) {
      // Release random acquired bit
      const arr = Array.from(acquired);
      const idx = lcg() % arr.length;
      const bit = arr[idx]!;
      pool.release(bit);
      acquired.delete(bit);
    }

    // Verify invariant holds throughout
    assertEquals(pool.availableCount + pool.occupiedCount, pool.size);
    assertEquals(pool.occupiedCount, acquired.size);
  }

  // Final verification via iterator
  const words = Array.from(pool);
  let countFromWords = 0;
  for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
    const word = words[wordIdx]!;
    for (let bit = 0; bit < 32; bit++) {
      const globalBit = wordIdx * 32 + bit;
      if (globalBit >= pool.size) break;
      const isSet = (word & (1 << bit)) !== 0;
      if (isSet) countFromWords++;
    }
  }
  assertEquals(countFromWords, pool.occupiedCount, "Iterator word count should match occupiedCount");
});

Deno.test("BitPool - stress test maintains nextAvailableIndex correctness", () => {
  const pool = new BitPool(256);

  // Fill completely
  for (let i = 0; i < 256; i++) {
    pool.acquire();
  }
  assertEquals(pool.nextAvailableIndex, -1);

  // Release bits at various positions
  const released = [10, 50, 100, 200];
  for (const bit of released) {
    pool.release(bit);
  }

  // nextAvailableIndex should be the last released
  assertEquals(pool.nextAvailableIndex, 200);

  // Acquire should get the last released first, then search forward
  assertEquals(pool.acquire(), 200);

  // After acquiring 200, findNextAvailable searches from 201 and wraps to find next
  // It will find the first available from the released list
  const acquired = new Set([pool.acquire(), pool.acquire(), pool.acquire()]);
  assertEquals(acquired.size, 3); // Should get 3 distinct bits
  assertEquals(acquired.has(10), true);
  assertEquals(acquired.has(50), true);
  assertEquals(acquired.has(100), true);

  // Now pool should be full again
  assertEquals(pool.acquire(), -1);
});

// ============================================================================
// Zero-Allocation Methods Tests
// ============================================================================

// forEachAvailable Tests
Deno.test("BitPool.forEachAvailable - should iterate all available indices", () => {
  const pool = new BitPool(32);
  pool.acquire(); // 0
  pool.acquire(); // 1

  const indices: number[] = [];
  pool.forEachAvailable((index) => indices.push(index));

  assertEquals(indices.length, 30);
  assertEquals(indices[0], 2);
  assertEquals(indices[indices.length - 1], 31);
});

Deno.test("BitPool.forEachAvailable - should return this for chaining", () => {
  const pool = new BitPool(8);
  const result = pool.forEachAvailable(() => {});
  assertEquals(result, pool);
});

Deno.test("BitPool.forEachAvailable - should respect range parameters", () => {
  const pool = new BitPool(32);

  const indices: number[] = [];
  pool.forEachAvailable((index) => indices.push(index), 5, 10);

  assertEquals(indices, [5, 6, 7, 8, 9]);
});

Deno.test("BitPool.forEachAvailable - should handle empty pool (all occupied)", () => {
  const pool = new BitPool(8);
  pool.fill();

  const indices: number[] = [];
  pool.forEachAvailable((index) => indices.push(index));

  assertEquals(indices, []);
});

Deno.test("BitPool.forEachAvailable - should handle start >= end", () => {
  const pool = new BitPool(32);

  const indices: number[] = [];
  pool.forEachAvailable((index) => indices.push(index), 10, 5);

  assertEquals(indices, []);
});

Deno.test("BitPool.forEachAvailable - should match generator output", () => {
  const pool = new BitPool(64);
  pool.acquire();
  pool.acquire();
  pool.acquire();

  const generatorIndices = Array.from(pool.availableIndices());
  const callbackIndices: number[] = [];
  pool.forEachAvailable((index) => callbackIndices.push(index));

  assertEquals(callbackIndices, generatorIndices);
});

// forEachOccupied Tests
Deno.test("BitPool.forEachOccupied - should iterate all occupied indices", () => {
  const pool = new BitPool(32);
  pool.acquire(); // 0
  pool.acquire(); // 1
  pool.acquire(); // 2

  const indices: number[] = [];
  pool.forEachOccupied((index) => indices.push(index));

  assertEquals(indices, [0, 1, 2]);
});

Deno.test("BitPool.forEachOccupied - should return this for chaining", () => {
  const pool = new BitPool(8);
  const result = pool.forEachOccupied(() => {});
  assertEquals(result, pool);
});

Deno.test("BitPool.forEachOccupied - should respect range parameters", () => {
  const pool = new BitPool(32);
  for (let i = 0; i < 10; i++) {
    pool.acquire();
  }

  const indices: number[] = [];
  pool.forEachOccupied((index) => indices.push(index), 3, 8);

  assertEquals(indices, [3, 4, 5, 6, 7]);
});

Deno.test("BitPool.forEachOccupied - should handle empty pool (none occupied)", () => {
  const pool = new BitPool(8);

  const indices: number[] = [];
  pool.forEachOccupied((index) => indices.push(index));

  assertEquals(indices, []);
});

Deno.test("BitPool.forEachOccupied - should match generator output", () => {
  const pool = new BitPool(64);
  pool.acquire();
  pool.acquire();
  pool.acquire();

  const generatorIndices = Array.from(pool.occupiedIndices());
  const callbackIndices: number[] = [];
  pool.forEachOccupied((index) => callbackIndices.push(index));

  assertEquals(callbackIndices, generatorIndices);
});

// forEachChunk Tests
Deno.test("BitPool.forEachChunk - should iterate all chunks", () => {
  const pool = new BitPool(64);
  pool.acquire(); // Set bit 0

  const chunks: Array<{ value: number; index: number }> = [];
  pool.forEachChunk((chunk, chunkIndex) => chunks.push({ value: chunk, index: chunkIndex }));

  assertEquals(chunks.length, 2);
  assertEquals(chunks[0]!.index, 0);
  assertEquals(chunks[1]!.index, 1);
  // First chunk should have bit 0 set (occupied)
  assertEquals(chunks[0]!.value & 1, 1);
});

Deno.test("BitPool.forEachChunk - should return this for chaining", () => {
  const pool = new BitPool(8);
  const result = pool.forEachChunk(() => {});
  assertEquals(result, pool);
});

Deno.test("BitPool.forEachChunk - should match Symbol.iterator output", () => {
  const pool = new BitPool(96);
  pool.acquire();
  pool.acquire();

  const iteratorValues = Array.from(pool);
  const callbackValues: number[] = [];
  pool.forEachChunk((chunk) => callbackValues.push(chunk));

  assertEquals(callbackValues, iteratorValues);
});

// availableIndicesInto Tests
Deno.test("BitPool.availableIndicesInto - should copy indices to buffer", () => {
  const pool = new BitPool(32);
  pool.acquire(); // 0
  pool.acquire(); // 1

  const buffer = new Uint32Array(32);
  const count = pool.availableIndicesInto(buffer);

  assertEquals(count, 30);
  assertEquals(buffer[0], 2);
  assertEquals(buffer[29], 31);
});

Deno.test("BitPool.availableIndicesInto - should respect range parameters", () => {
  const pool = new BitPool(32);

  const buffer = new Uint32Array(10);
  const count = pool.availableIndicesInto(buffer, 5, 10);

  assertEquals(count, 5);
  assertEquals(Array.from(buffer.subarray(0, count)), [5, 6, 7, 8, 9]);
});

Deno.test("BitPool.availableIndicesInto - should return 0 for empty range", () => {
  const pool = new BitPool(32);

  const buffer = new Uint32Array(32);
  const count = pool.availableIndicesInto(buffer, 10, 5);

  assertEquals(count, 0);
});

Deno.test("BitPool.availableIndicesInto - should match generator output", () => {
  const pool = new BitPool(64);
  pool.acquire();
  pool.acquire();
  pool.acquire();

  const generatorIndices = Array.from(pool.availableIndices());
  const buffer = new Uint32Array(64);
  const count = pool.availableIndicesInto(buffer);

  assertEquals(count, generatorIndices.length);
  assertEquals(Array.from(buffer.subarray(0, count)), generatorIndices);
});

Deno.test("BitPool.availableIndicesInto - should handle full pool", () => {
  const pool = new BitPool(32);
  pool.fill();

  const buffer = new Uint32Array(32);
  const count = pool.availableIndicesInto(buffer);

  assertEquals(count, 0);
});

// occupiedIndicesInto Tests
Deno.test("BitPool.occupiedIndicesInto - should copy indices to buffer", () => {
  const pool = new BitPool(32);
  pool.acquire(); // 0
  pool.acquire(); // 1
  pool.acquire(); // 2

  const buffer = new Uint32Array(32);
  const count = pool.occupiedIndicesInto(buffer);

  assertEquals(count, 3);
  assertEquals(Array.from(buffer.subarray(0, count)), [0, 1, 2]);
});

Deno.test("BitPool.occupiedIndicesInto - should respect range parameters", () => {
  const pool = new BitPool(32);
  for (let i = 0; i < 10; i++) {
    pool.acquire();
  }

  const buffer = new Uint32Array(10);
  const count = pool.occupiedIndicesInto(buffer, 3, 8);

  assertEquals(count, 5);
  assertEquals(Array.from(buffer.subarray(0, count)), [3, 4, 5, 6, 7]);
});

Deno.test("BitPool.occupiedIndicesInto - should return 0 for empty pool", () => {
  const pool = new BitPool(32);

  const buffer = new Uint32Array(32);
  const count = pool.occupiedIndicesInto(buffer);

  assertEquals(count, 0);
});

Deno.test("BitPool.occupiedIndicesInto - should match generator output", () => {
  const pool = new BitPool(64);
  pool.acquire();
  pool.acquire();
  pool.acquire();

  const generatorIndices = Array.from(pool.occupiedIndices());
  const buffer = new Uint32Array(64);
  const count = pool.occupiedIndicesInto(buffer);

  assertEquals(count, generatorIndices.length);
  assertEquals(Array.from(buffer.subarray(0, count)), generatorIndices);
});

// Multi-chunk tests for zero-allocation methods
Deno.test("BitPool.forEachAvailable - should work across chunk boundaries", () => {
  const pool = new BitPool(100);
  // Acquire some bits in different chunks
  pool.acquire(); // 0
  pool.acquire(); // 1
  for (let i = 0; i < 30; i++) pool.acquire(); // 2-31 (fill first chunk)
  pool.acquire(); // 32 (second chunk)

  const indices: number[] = [];
  pool.forEachAvailable((index) => indices.push(index));

  assertEquals(indices.length, 100 - 33);
  assertEquals(indices[0], 33); // First available in second chunk
});

Deno.test("BitPool.availableIndicesInto - should work across chunk boundaries", () => {
  const pool = new BitPool(100);
  // Fill first chunk completely
  for (let i = 0; i < 32; i++) pool.acquire();

  const buffer = new Uint32Array(100);
  const count = pool.availableIndicesInto(buffer);

  assertEquals(count, 68); // 100 - 32
  assertEquals(buffer[0], 32); // First available in second chunk
});

Deno.test("BitPool.forEachOccupied - should work across chunk boundaries", () => {
  const pool = new BitPool(100);
  pool.acquire(); // 0
  // Skip to second chunk
  for (let i = 1; i < 35; i++) pool.acquire();

  const indices: number[] = [];
  pool.forEachOccupied((index) => indices.push(index));

  assertEquals(indices.length, 35);
  assertEquals(indices[0], 0);
  assertEquals(indices[32], 32); // First in second chunk
});

Deno.test("BitPool.occupiedIndicesInto - should work across chunk boundaries", () => {
  const pool = new BitPool(100);
  for (let i = 0; i < 40; i++) pool.acquire();

  const buffer = new Uint32Array(100);
  const count = pool.occupiedIndicesInto(buffer);

  assertEquals(count, 40);
  assertEquals(buffer[31], 31); // Last in first chunk
  assertEquals(buffer[32], 32); // First in second chunk
});
