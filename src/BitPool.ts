/**
 * @description A high-performance BitPool for managing available/occupied indices.
 * @copyright   2025 the BitPool authors. All rights reserved.
 * @license     MIT
 * @module      BitPool
 */

import { BooleanArray } from "@phughesmcr/booleanarray";

/**
 * A high-performance bit pool for managing resource allocation.
 *
 * Internal representation: `false` = available, `true` = occupied.
 *
 * **Allocation behavior:**
 * - Generator methods (`availableIndices`, `occupiedIndices`, `Symbol.iterator`) allocate iterator objects.
 * - Methods named `forEach*` and `*Into` are truly zero-allocation.
 * - `release()` uses LIFO semantics: the released index becomes `nextAvailableIndex` for cache-friendly reuse.
 */
export class BitPool {
  /** Returns the string tag for this class. */
  get [Symbol.toStringTag](): string {
    return "BitPool";
  }

  /** The maximum safe size of the pool. */
  static readonly MAX_SAFE_SIZE = BooleanArray.MAX_SAFE_SIZE;

  /** The maximum safe value for a Uint32Array. */
  static readonly MAX_SAFE_VALUE = BooleanArray.ALL_BITS_TRUE;

  /**
   * Creates a new BitPool from an array of uint32 values representing bit patterns.
   * Each uint32 value represents 32 bits where 1 = occupied, 0 = available.
   * @param capacity The total size of the pool
   * @param array The array of uint32 values to use as the initial state
   * @returns A new BitPool
   *
   * @example
   * ```ts
   * // Create a pool of 32 bits with first 4 bits occupied
   * const pool = BitPool.fromArray(32, [0b00001111]); // bits 0-3 occupied, 4-31 available
   * ```
   */
  static fromArray(capacity: number, array: ArrayLike<number>): BitPool {
    return BitPool.fromUint32Array(capacity, array);
  }

  /**
   * Creates a new BitPool from a Uint32Array or number array.
   * Each uint32 value represents 32 bits where 1 = occupied, 0 = available.
   * @param capacity The total size of the pool
   * @param array The array to use as the pool
   * @returns A new BitPool
   * @throws {TypeError} If capacity is not a safe integer
   * @throws {RangeError} If capacity is less than 1 or greater than MAX_SAFE_SIZE
   * @throws {RangeError} If capacity is too small for the provided array
   *
   * @example
   * ```ts
   * // Create a pool of 128 bits, explicitly specifying each chunk of 32 bits
   * // Each uint32 represents 32 bits where 1 = occupied, 0 = available
   * const pool = BitPool.fromUint32Array(128, [0b00001111, 0b11110000, 0b10101010, 0]);
   * // bits 0-3 occupied, 4-31 available, bits 32-35 available, 36-39 occupied, etc.
   * ```
   */
  static fromUint32Array(capacity: number, array: ArrayLike<number>): BitPool {
    // Check if capacity is large enough for the array
    capacity = BooleanArray.assertIsSafeSize(capacity);
    const requiredCapacity = array.length * BooleanArray.BITS_PER_INT;
    if (requiredCapacity > 0 && capacity < requiredCapacity) {
      throw new RangeError(`For the array to fit, "capacity" must be greater than or equal to ${requiredCapacity}`);
    }
    const arr = BooleanArray.fromUint32Array(capacity, array);
    return new BitPool(arr);
  }

  #availableCount: number;
  #data: BooleanArray; // false = available, true = occupied
  #nextAvailableIndex: number = 0;

  /**
   * Creates a new BitPool from a BooleanArray.
   * @param array The BooleanArray to use as the pool
   */
  constructor(array: BooleanArray);
  /**
   * Creates a new BitPool with the specified size.
   * @param size The number of indices to manage (must be a positive integer)
   * @throws {RangeError} if size is less than 1, or is greater than BitPool.MAX_SAFE_SIZE
   * @throws {TypeError} if size is not a safe integer
   */
  constructor(size: number);
  constructor(arrayOrSize: BooleanArray | number) {
    if (typeof arrayOrSize === "number") {
      this.#data = new BooleanArray(arrayOrSize);
      this.#availableCount = this.#data.size;
    } else {
      this.#data = arrayOrSize;
      const occupiedCount = this.#data.getTruthyCount();
      this.#availableCount = this.#data.size - occupiedCount;
      this.#nextAvailableIndex = this.#data.indexOf(false);
    }
  }

  /** Gets the number of available slots. */
  get availableCount(): number {
    return this.#availableCount;
  }

  /** Checks if the pool is empty (all slots available). */
  get isEmpty(): boolean {
    return this.#availableCount === this.#data.size;
  }

  /** Checks if the pool is full (no slots available). */
  get isFull(): boolean {
    return this.#availableCount === 0;
  }

  /** Gets the next available index, or -1 if pool is full. */
  get nextAvailableIndex(): number {
    return this.#nextAvailableIndex;
  }

  /** Gets the number of occupied slots. */
  get occupiedCount(): number {
    return this.#data.size - this.#availableCount;
  }

  /** Gets the total size of the pool. */
  get size(): number {
    return this.#data.size;
  }

  /**
   * Acquires the next available index.
   * @returns The acquired index, or -1 if pool is full.
   */
  acquire(): number {
    if (this.#availableCount === 0 || this.#nextAvailableIndex === -1) {
      return -1;
    }
    const index = this.#nextAvailableIndex;
    this.#data.set(index, true); // Mark as occupied
    this.#availableCount--;
    this.#nextAvailableIndex = this.findNextAvailable(index, true);
    return index;
  }

  /** Clears the pool, making all indices available. */
  clear(): void {
    this.#data.fill(false); // All available
    this.#nextAvailableIndex = 0;
    this.#availableCount = this.#data.size;
  }

  /** Clones the pool. */
  clone(): BitPool {
    return new BitPool(this.#data.clone());
  }

  /**
   * Returns a copy of the internal buffer as a Uint32Array.
   * Each uint32 represents 32 bits where 1 = occupied, 0 = available.
   *
   * Use with {@link fromUint32Array} for serialization/deserialization.
   *
   * @returns A new Uint32Array containing the pool's bit data
   * @note This method allocates a new Uint32Array.
   *
   * @example
   * ```ts
   * const pool = new BitPool(64);
   * pool.acquire(); // 0
   * pool.acquire(); // 1
   * const serialized = pool.toUint32Array();
   * // Later...
   * const restored = BitPool.fromUint32Array(64, serialized);
   * ```
   */
  toUint32Array(): Uint32Array {
    return this.#data.buffer.slice();
  }

  /**
   * Checks if an index is available.
   * @param index The index to check
   * @returns True if the index is available
   * @throws {TypeError} When index is not a number
   * @throws {RangeError} When index is out of bounds
   */
  isAvailable(index: number): boolean {
    if (typeof index !== "number" || isNaN(index)) {
      throw new TypeError('"index" must be a number');
    }
    return !this.#data.get(index);
  }

  /**
   * Checks if an index is occupied.
   * @param index The index to check
   * @returns True if the index is occupied
   * @throws {TypeError} When index is not a safe integer
   * @throws {RangeError} When index is out of bounds
   */
  isOccupied(index: number): boolean {
    return this.#data.get(index);
  }

  /** Fills the pool, marking all indices as occupied. */
  fill(): void {
    this.#data.fill(true); // All occupied
    this.#nextAvailableIndex = -1;
    this.#availableCount = 0;
  }

  /**
   * Finds the next available index starting from the current index.
   * @param startIndex The index to start searching from (optional)
   * @param loop Whether to loop back to the beginning if the end is reached
   * @returns The next available index or -1 if no more are available
   */
  findNextAvailable(startIndex?: number, loop: boolean = false): number {
    if (this.#availableCount === 0) {
      return -1;
    }
    const currentIndex = startIndex ?? this.#nextAvailableIndex;

    // Ensure we don't search beyond bounds
    if (currentIndex < 0 || currentIndex >= this.#data.size) {
      return this.#data.indexOf(false);
    }
    const buffer = this.#data.buffer;
    const size = this.#data.size;
    const chunkCount = this.#data.chunkCount;
    const start = currentIndex + 1;

    // Scan from start to end
    let chunk = BooleanArray.getChunk(start);
    let bitOffset = BooleanArray.getChunkOffset(start);
    for (; chunk < chunkCount; chunk++) {
      const chunkStart = chunk * BooleanArray.BITS_PER_INT;
      let bitsInChunk = size - chunkStart;
      if (bitsInChunk <= 0) break;
      if (bitsInChunk > BooleanArray.BITS_PER_INT) bitsInChunk = BooleanArray.BITS_PER_INT;
      const lowerMask = bitOffset === 0 ? 0 : ((1 << bitOffset) - 1);
      const upperMask = bitsInChunk === BooleanArray.BITS_PER_INT
        ? BooleanArray.ALL_BITS_TRUE
        : ((1 << bitsInChunk) - 1);
      const mask = (upperMask & ~lowerMask) >>> 0;
      const availableMask = (~buffer[chunk]!) & mask;
      if (availableMask) {
        return chunkStart + BooleanArray.getLSBPosition(availableMask);
      }
      bitOffset = 0; // only applies to first chunk in this scan
    }

    if (loop) {
      // Scan from 0 to currentIndex
      const endExclusive = currentIndex + 1;
      const endChunk = BooleanArray.getChunk(endExclusive - 1);
      for (let c = 0; c <= endChunk; c++) {
        const chunkStart = c * BooleanArray.BITS_PER_INT;
        const s = 0;
        const e = Math.min(endExclusive - chunkStart, BooleanArray.BITS_PER_INT);
        if (e <= s) continue;
        const upperMask = e === BooleanArray.BITS_PER_INT ? BooleanArray.ALL_BITS_TRUE : ((1 << e) - 1);
        const mask = upperMask >>> 0;
        const availableMask = (~buffer[c]!) & mask;
        if (availableMask) {
          return chunkStart + BooleanArray.getLSBPosition(availableMask);
        }
      }
    }
    return -1;
  }

  /** Refreshes the pool, ensuring the next available index is set to the first available index. */
  refresh(): void {
    this.#nextAvailableIndex = this.#data.indexOf(false);
  }

  /**
   * Releases an occupied index back to the pool.
   *
   * Uses LIFO semantics: the released index becomes `nextAvailableIndex`,
   * so the next `acquire()` will return this index. This provides cache-friendly
   * reuse patterns. Call `refresh()` after releasing to reset to lowest available.
   *
   * @param index The index to release
   * @throws {TypeError} If index is NaN
   */
  release(index: number): void {
    // Throw for NaN specifically as expected by tests
    if (typeof index !== "number" || isNaN(index)) {
      throw new TypeError('"index" must be a number');
    }

    // Handle other invalid inputs gracefully
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.#data.size) {
      return; // Ignore invalid indices
    }

    if (!this.#data.get(index)) {
      return; // Already available
    }
    this.#data.set(index, false); // Mark as available
    this.#availableCount++;

    // LIFO: Set nextAvailableIndex to the most recently released index
    this.#nextAvailableIndex = index;
  }

  /**
   * Releases multiple indices back to the pool.
   *
   * Invalid indices are silently ignored (same behavior as `release()`).
   * After batch release, `nextAvailableIndex` will be the last valid released index.
   *
   * @param indices An iterable of indices to release
   */
  releaseAll(indices: Iterable<number>): void {
    for (const index of indices) {
      this.release(index);
    }
  }

  /**
   * Batch acquire multiple indices with all-or-nothing semantics.
   *
   * @param count The number of indices to acquire
   * @returns An array of acquired indices
   * @throws {TypeError} If count is not a non-negative integer
   * @throws {RangeError} If there are fewer than `count` available indices
   * @note This method allocates an array. For zero-allocation batch acquire, use {@link acquireNInto}.
   */
  acquireN(count: number): number[] {
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      throw new TypeError('"count" must be a non-negative integer');
    }
    if (count > this.#availableCount) {
      throw new RangeError(`Cannot acquire ${count} indices; only ${this.#availableCount} available`);
    }
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.acquire());
    }
    return result;
  }

  /**
   * Zero-allocation batch acquire into a preallocated buffer.
   *
   * Fills as many indices as possible up to `out.length`. Does not throw
   * if fewer indices are available than requested; caller should check return value.
   *
   * @param out Destination buffer to write acquired indices into
   * @returns Number of indices actually acquired (may be less than `out.length`)
   */
  acquireNInto(out: Uint32Array): number {
    let count = 0;
    while (count < out.length && !this.isFull) {
      out[count++] = this.acquire();
    }
    return count;
  }

  /**
   * Iterator that yields the underlying uint32 chunk values.
   * @note This method allocates an iterator object. For zero-allocation iteration, use {@link forEachChunk}.
   */
  *[Symbol.iterator](): IterableIterator<number> {
    for (let i = 0; i < this.#data.chunkCount; i++) {
      yield this.#data.buffer[i]!;
    }
  }

  /**
   * Iterator that yields all available indices in the pool.
   * @param startIndex Inclusive start index (default: 0)
   * @param endIndex Exclusive end index (default: pool size)
   * @note This method allocates an iterator object. For zero-allocation iteration, use {@link forEachAvailable}.
   */
  *availableIndices(startIndex: number = 0, endIndex: number = this.#data.size): IterableIterator<number> {
    const buffer = this.#data.buffer;
    const size = this.#data.size;
    const actualStartIndex = Math.max(startIndex, 0);
    const actualEndIndex = Math.min(endIndex, size);
    if (actualStartIndex >= actualEndIndex) return;
    const startChunk = BooleanArray.getChunk(actualStartIndex);
    const endChunk = BooleanArray.getChunk(actualEndIndex - 1);
    for (let chunk = startChunk; chunk <= endChunk; chunk++) {
      const chunkStart = chunk * BooleanArray.BITS_PER_INT;
      const s = Math.max(actualStartIndex - chunkStart, 0);
      const e = Math.min(actualEndIndex - chunkStart, BooleanArray.BITS_PER_INT);
      if (s >= e) continue;
      const lowerMask = s === 0 ? 0 : ((1 << s) - 1);
      const upperMask = e === BooleanArray.BITS_PER_INT ? BooleanArray.ALL_BITS_TRUE : ((1 << e) - 1);
      const mask = (upperMask & ~lowerMask) >>> 0;
      let word = (~buffer[chunk]!) & mask;
      while (word) {
        const bit = BooleanArray.getLSBPosition(word);
        yield chunkStart + bit;
        word &= word - 1;
      }
    }
  }

  /**
   * Iterator that yields all occupied indices in the pool.
   * @param startIndex Inclusive start index (default: 0)
   * @param endIndex Exclusive end index (default: pool size)
   * @note This method allocates an iterator object. For zero-allocation iteration, use {@link forEachOccupied}.
   */
  *occupiedIndices(startIndex: number = 0, endIndex: number = this.#data.size): IterableIterator<number> {
    const buffer = this.#data.buffer;
    const size = this.#data.size;
    const actualStartIndex = Math.max(startIndex, 0);
    const actualEndIndex = Math.min(endIndex, size);
    if (actualStartIndex >= actualEndIndex) return;
    const startChunk = BooleanArray.getChunk(actualStartIndex);
    const endChunk = BooleanArray.getChunk(actualEndIndex - 1);
    for (let chunk = startChunk; chunk <= endChunk; chunk++) {
      const chunkStart = chunk * BooleanArray.BITS_PER_INT;
      const s = Math.max(actualStartIndex - chunkStart, 0);
      const e = Math.min(actualEndIndex - chunkStart, BooleanArray.BITS_PER_INT);
      if (s >= e) continue;
      const lowerMask = s === 0 ? 0 : ((1 << s) - 1);
      const upperMask = e === BooleanArray.BITS_PER_INT ? BooleanArray.ALL_BITS_TRUE : ((1 << e) - 1);
      const mask = (upperMask & ~lowerMask) >>> 0;
      let word = buffer[chunk]! & mask;
      while (word) {
        const bit = BooleanArray.getLSBPosition(word);
        yield chunkStart + bit;
        word &= word - 1;
      }
    }
  }

  /**
   * Zero-allocation iteration over available indices via callback.
   * @param callback Function called for each available index
   * @param startIndex Inclusive start index (default: 0)
   * @param endIndex Exclusive end index (default: pool size)
   * @returns this for chaining
   */
  forEachAvailable(
    callback: (index: number) => void,
    startIndex: number = 0,
    endIndex: number = this.#data.size,
  ): this {
    const actualStart = Math.max(startIndex, 0);
    const actualEnd = Math.min(endIndex, this.#data.size);
    if (actualStart >= actualEnd) return this;
    this.#data.forEachFalsy(callback, actualStart, actualEnd);
    return this;
  }

  /**
   * Zero-allocation iteration over occupied indices via callback.
   * @param callback Function called for each occupied index
   * @param startIndex Inclusive start index (default: 0)
   * @param endIndex Exclusive end index (default: pool size)
   * @returns this for chaining
   */
  forEachOccupied(
    callback: (index: number) => void,
    startIndex: number = 0,
    endIndex: number = this.#data.size,
  ): this {
    const actualStart = Math.max(startIndex, 0);
    const actualEnd = Math.min(endIndex, this.#data.size);
    if (actualStart >= actualEnd) return this;
    this.#data.forEachTruthy(callback, actualStart, actualEnd);
    return this;
  }

  /**
   * Zero-allocation iteration over raw uint32 chunk values via callback.
   * @param callback Function called for each chunk (value, chunkIndex)
   * @returns this for chaining
   */
  forEachChunk(callback: (chunk: number, chunkIndex: number) => void): this {
    const buffer = this.#data.buffer;
    const len = this.#data.chunkCount;
    for (let i = 0; i < len; i++) {
      callback(buffer[i]!, i);
    }
    return this;
  }

  /**
   * Copy available indices into a preallocated Uint32Array.
   * @param out Destination buffer (must have sufficient length)
   * @param startIndex Inclusive start index (default: 0)
   * @param endIndex Exclusive end index (default: pool size)
   * @returns Number of indices written to the buffer
   */
  availableIndicesInto(
    out: Uint32Array,
    startIndex: number = 0,
    endIndex: number = this.#data.size,
  ): number {
    const actualStart = Math.max(startIndex, 0);
    const actualEnd = Math.min(endIndex, this.#data.size);
    if (actualStart >= actualEnd) return 0;
    return this.#data.falsyIndicesInto(out, actualStart, actualEnd);
  }

  /**
   * Copy occupied indices into a preallocated Uint32Array.
   * @param out Destination buffer (must have sufficient length)
   * @param startIndex Inclusive start index (default: 0)
   * @param endIndex Exclusive end index (default: pool size)
   * @returns Number of indices written to the buffer
   */
  occupiedIndicesInto(
    out: Uint32Array,
    startIndex: number = 0,
    endIndex: number = this.#data.size,
  ): number {
    const actualStart = Math.max(startIndex, 0);
    const actualEnd = Math.min(endIndex, this.#data.size);
    if (actualStart >= actualEnd) return 0;
    return this.#data.truthyIndicesInto(out, actualStart, actualEnd);
  }

  /**
   * Internal helper for binary set operations.
   * @param other The other BitPool
   * @param op Bitwise operation to apply (a, b) => result
   * @param opName Name for error messages
   */
  #binaryOp(other: BitPool, op: (a: number, b: number) => number, opName: string): BitPool {
    if (this.size !== other.size) {
      throw new RangeError(`BitPool sizes must match for ${opName}`);
    }
    const result = new BitPool(this.size);
    const resultBuffer = result.#data.buffer;
    const thisBuffer = this.#data.buffer;
    const otherBuffer = other.#data.buffer;
    const chunkCount = this.#data.chunkCount;

    let occupiedCount = 0;
    for (let i = 0; i < chunkCount; i++) {
      const value = op(thisBuffer[i]!, otherBuffer[i]!);
      resultBuffer[i] = value;
      occupiedCount += BooleanArray.popcount(value);
    }

    result.#availableCount = result.size - occupiedCount;
    result.#nextAvailableIndex = result.#data.indexOf(false);
    return result;
  }

  /**
   * Returns a new BitPool containing only indices occupied in both pools (AND operation).
   *
   * @param other The other BitPool to intersect with
   * @returns A new BitPool with the intersection
   * @throws {RangeError} If the pools have different sizes
   *
   * @example
   * ```ts
   * const a = new BitPool(32);
   * a.acquireN(4); // occupies 0, 1, 2, 3
   * const b = new BitPool(32);
   * b.acquireN(2); // occupies 0, 1
   * const intersection = a.intersect(b); // occupies 0, 1
   * ```
   */
  intersect(other: BitPool): BitPool {
    return this.#binaryOp(other, (a, b) => a & b, "intersection");
  }

  /**
   * Returns a new BitPool containing indices occupied in either pool (OR operation).
   *
   * @param other The other BitPool to union with
   * @returns A new BitPool with the union
   * @throws {RangeError} If the pools have different sizes
   *
   * @example
   * ```ts
   * const a = new BitPool(32);
   * a.acquireN(2); // occupies 0, 1
   * const b = new BitPool(32);
   * b.acquire(); b.acquire(); b.acquire(); b.acquire();
   * b.release(0); b.release(1); // occupies 2, 3
   * const union = a.union(b); // occupies 0, 1, 2, 3
   * ```
   */
  union(other: BitPool): BitPool {
    return this.#binaryOp(other, (a, b) => a | b, "union");
  }

  /**
   * Returns a new BitPool containing indices occupied in this pool but not in the other (AND NOT operation).
   *
   * @param other The other BitPool to subtract
   * @returns A new BitPool with the difference
   * @throws {RangeError} If the pools have different sizes
   *
   * @example
   * ```ts
   * const a = new BitPool(32);
   * a.acquireN(4); // occupies 0, 1, 2, 3
   * const b = new BitPool(32);
   * b.acquireN(2); // occupies 0, 1
   * const diff = a.difference(b); // occupies 2, 3 (in a but not in b)
   * ```
   */
  difference(other: BitPool): BitPool {
    return this.#binaryOp(other, (a, b) => a & ~b, "difference");
  }

  /**
   * Returns a new BitPool containing indices occupied in exactly one of the pools (XOR operation).
   *
   * @param other The other BitPool
   * @returns A new BitPool with the symmetric difference
   * @throws {RangeError} If the pools have different sizes
   *
   * @example
   * ```ts
   * const a = new BitPool(32);
   * a.acquireN(3); // occupies 0, 1, 2
   * const b = new BitPool(32);
   * b.acquire(); b.acquire(); b.acquire(); b.acquire();
   * b.release(0); // occupies 1, 2, 3
   * const symDiff = a.symmetricDifference(b); // occupies 0, 3 (in one but not both)
   * ```
   */
  symmetricDifference(other: BitPool): BitPool {
    return this.#binaryOp(other, (a, b) => a ^ b, "symmetric difference");
  }
}
