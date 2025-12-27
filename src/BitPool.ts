/**
 * @description A high-performance BitPool for managing available/occupied indices.
 * @copyright   2025 the BitPool authors. All rights reserved.
 * @license     MIT
 * @module      BitPool
 */

import { BooleanArray } from "@phughesmcr/booleanarray";

/**
 * A high-performance bit pool for managing resource allocation.
 * Uses false = available, true = occupied for optimal performance.
 */
export class BitPool {
  /** The maximum safe size of the pool. */
  static readonly MAX_SAFE_SIZE = BooleanArray.MAX_SAFE_SIZE;

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
    // Validate capacity
    if (typeof capacity !== "number" || !Number.isSafeInteger(capacity)) {
      throw new TypeError('"value" must be a safe integer');
    }
    if (capacity <= 0) {
      throw new RangeError('"capacity" must be greater than 0');
    }
    if (capacity > BitPool.MAX_SAFE_SIZE) {
      throw new RangeError('"value" must be smaller than or equal to 536870911.');
    }

    // Validate array
    // Accept any array-like numbers to reduce conversions
    // Explicitly reject strings since they are array-like but not valid input
    if (array == null || typeof array === "string" || typeof (array as ArrayLike<number>).length !== "number") {
      throw new TypeError('"arr" must be an array-like of numbers.');
    }

    // Check if capacity is large enough for the array
    const requiredCapacity = array.length * BooleanArray.BITS_PER_INT;
    if (capacity < requiredCapacity) {
      throw new RangeError(`For the array to fit, "capacity" must be greater than or equal to ${requiredCapacity}`);
    }

    // Validate array values are numbers and in valid range
    for (let i = 0; i < array.length; i++) {
      const value = array[i]!;
      if (typeof value !== "number") {
        throw new TypeError('"arr" must be an array of numbers.');
      }
      if (!Number.isSafeInteger(value)) {
        throw new TypeError('"value" must be a safe integer');
      }
      if (value < 0) {
        throw new RangeError('"value" must be greater than or equal to 0');
      }
      if (value > 0xFFFFFFFF) {
        throw new RangeError('"value" must be smaller than or equal to 4294967295');
      }
    }

    // Convert to BooleanArray using fromUint32Array
    // Input semantics: 1 = occupied, 0 = available
    // BooleanArray semantics: true = 1 bit, false = 0 bit
    // BitPool semantics: true = occupied, false = available
    // These semantics are the same, so no inversion is needed
    const arr = BooleanArray.fromUint32Array(capacity, array);
    return new BitPool(arr);
  }

  /**
   * Creates a new BitPool from a Uint32Array or number array.
   * Each uint32 value represents 32 bits where 1 = occupied, 0 = available.
   * @param capacity The total size of the pool
   * @param array The array to use as the pool
   * @returns A new BitPool
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
    // Validate capacity
    if (typeof capacity !== "number" || !Number.isSafeInteger(capacity)) {
      throw new TypeError('"value" must be a safe integer');
    }
    if (capacity <= 0) {
      throw new RangeError('"capacity" must be greater than 0');
    }
    if (capacity > BitPool.MAX_SAFE_SIZE) {
      throw new RangeError('"value" must be smaller than or equal to 536870911.');
    }

    // Check if capacity is large enough for the array
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
      if (arrayOrSize < 1) { // other validations are handled by BooleanArray
        throw new RangeError('"size" must be greater than 0');
      }
      this.#data = new BooleanArray(arrayOrSize);
      this.#availableCount = this.#data.size;
    } else {
      this.#data = arrayOrSize;
      // Use BooleanArray's optimized methods for counting and finding
      // getTruthyCount() returns count of occupied (true) bits
      const occupiedCount = this.#data.getTruthyCount();
      this.#availableCount = this.#data.size - occupiedCount;
      // indexOf(false) finds first available slot
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
   * @throws {RangeError} When index is out of bounds
   */
  isOccupied(index: number): boolean {
    if (typeof index !== "number" || isNaN(index)) {
      throw new TypeError('"index" must be a number');
    }
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
        const lsb = availableMask & -availableMask;
        const bit = (BooleanArray.BITS_PER_INT - 1) - Math.clz32(lsb);
        return chunkStart + bit;
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
          const lsb = availableMask & -availableMask;
          const bit = (BooleanArray.BITS_PER_INT - 1) - Math.clz32(lsb);
          return chunkStart + bit;
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
   * @param index The index to release
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

    // Set nextAvailableIndex to the most recently released index
    this.#nextAvailableIndex = index;
  }

  /** Iterator that yields the underlying uint32array values. */
  *[Symbol.iterator](): IterableIterator<number> {
    for (let i = 0; i < this.#data.length; i++) {
      yield this.#data.buffer[i]!;
    }
  }

  /** Iterator that yields all available indices in the pool. */
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
        const lsb = word & -word;
        const bit = (BooleanArray.BITS_PER_INT - 1) - Math.clz32(lsb);
        yield chunkStart + bit;
        word &= word - 1;
      }
    }
  }

  /** Iterator that yields all occupied indices in the pool. */
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
        const lsb = word & -word;
        const bit = (BooleanArray.BITS_PER_INT - 1) - Math.clz32(lsb);
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
    const buffer = this.#data.buffer;
    const size = this.#data.size;
    const actualStartIndex = Math.max(startIndex, 0);
    const actualEndIndex = Math.min(endIndex, size);
    if (actualStartIndex >= actualEndIndex) return this;
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
        const lsb = word & -word;
        const bit = (BooleanArray.BITS_PER_INT - 1) - Math.clz32(lsb);
        callback(chunkStart + bit);
        word &= word - 1;
      }
    }
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
    this.#data.forEachTruthy(callback, startIndex, endIndex);
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
    const buffer = this.#data.buffer;
    const size = this.#data.size;
    const actualStartIndex = Math.max(startIndex, 0);
    const actualEndIndex = Math.min(endIndex, size);
    if (actualStartIndex >= actualEndIndex) return 0;
    const startChunk = BooleanArray.getChunk(actualStartIndex);
    const endChunk = BooleanArray.getChunk(actualEndIndex - 1);
    let count = 0;
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
        const lsb = word & -word;
        const bit = (BooleanArray.BITS_PER_INT - 1) - Math.clz32(lsb);
        out[count++] = chunkStart + bit;
        word &= word - 1;
      }
    }
    return count;
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
    return this.#data.truthyIndicesInto(out, startIndex, endIndex);
  }
}
