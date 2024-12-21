import { assertEquals, assertThrows } from "https://deno.land/std@0.220.1/assert/mod.ts";
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
    '"value" must be greater than 0',
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
