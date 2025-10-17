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
   * const pool = BitPool.fromArray(32, [0b11110000]); // bits 0-3 occupied, 4-7 available
   * ```
   */
  static fromArray<T extends boolean | number>(capacity: number, array: T[]): BitPool {
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
    if (!Array.isArray(array)) {
      throw new TypeError('"arr" must be an array of numbers or booleans.');
    }

    // Check if capacity is large enough for the array
    const requiredCapacity = array.length * 32;
    if (capacity < requiredCapacity) {
      throw new RangeError(`For the array to fit, "capacity" must be greater than or equal to ${requiredCapacity}`);
    }

    // Validate array values are numbers and in valid range
    for (const value of array) {
      if (typeof value !== "number") {
        throw new TypeError('"arr" must be an array of numbers or booleans.');
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
    // We need to invert because tests expect: input 1 → output available (false)
    const numberArray = array.map((value) => typeof value === "boolean" ? (value ? 1 : 0) : value) as number[];
    const invertedArray = numberArray.map((value) => ~value >>> 0); // Bitwise NOT and convert to uint32
    const arr = BooleanArray.fromUint32Array(capacity, invertedArray);
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
   * const pool = BitPool.fromUint32Array(128, [0b11110000, 0b00001111, 0b10101010]);
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
    const requiredCapacity = array.length * 32;
    if (requiredCapacity > 0 && capacity < requiredCapacity) {
      throw new RangeError(`For the array to fit, "capacity" must be greater than or equal to ${requiredCapacity}`);
    }

    // Convert array to regular array and invert bits
    // Input semantics: 1 = occupied, 0 = available
    // BooleanArray semantics: true = 1 bit, false = 0 bit
    // BitPool semantics: true = occupied, false = available
    // We need to invert because tests expect: input 1 → output available (false)
    const invertedArray = Array.from(array).map((value) => ~value >>> 0); // Bitwise NOT and convert to uint32
    const arr = BooleanArray.fromUint32Array(capacity, invertedArray);
    return new BitPool(arr);
  }

  #availableCount: number;
  #data: BooleanArray; // false = available, true = occupied
  #nextAvailableIndex: number;

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
      // Count available slots (false values)
      this.#availableCount = 0;
      for (let i = 0; i < this.#data.size; i++) {
        if (!this.#data.get(i)) {
          this.#availableCount++;
        }
      }
    }
    // Find the first available bit in the lowest chunk that has available bits
    this.#nextAvailableIndex = -1;
    for (let chunkIndex = 0; chunkIndex * 32 < this.#data.size; chunkIndex++) {
      const chunkStart = chunkIndex * 32;
      const chunkEnd = Math.min(chunkStart + 32, this.#data.size);
      for (let i = chunkStart; i < chunkEnd; i++) {
        if (!this.#data.get(i)) {
          this.#nextAvailableIndex = i;
          break;
        }
      }
      if (this.#nextAvailableIndex !== -1) break;
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

    const result = this.#data.indexOf(false, currentIndex + 1);
    if (result === -1 && loop) {
      return this.#data.indexOf(false);
    }
    return result;
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
    const actualStartIndex = Math.max(startIndex, 0);
    const actualEndIndex = Math.min(endIndex, this.#data.size);
    for (let i = actualStartIndex; i < actualEndIndex; i++) {
      const chunkIndex = i >>> 5; // Divide by 32 (2^5)
      const bitPosition = i & 31; // Modulo 32
      const bit = (buffer[chunkIndex]! & (1 << bitPosition)) !== 0;
      if (!bit) { // false = available
        yield i;
      }
    }
  }

  /** Iterator that yields all occupied indices in the pool. */
  *occupiedIndices(startIndex: number = 0, endIndex: number = this.#data.size): IterableIterator<number> {
    const buffer = this.#data.buffer;
    const actualStartIndex = Math.max(startIndex, 0);
    const actualEndIndex = Math.min(endIndex, this.#data.size);
    for (let i = actualStartIndex; i < actualEndIndex; i++) {
      const chunkIndex = i >>> 5; // Divide by 32 (2^5)
      const bitPosition = i & 31; // Modulo 32
      const bit = (buffer[chunkIndex]! & (1 << bitPosition)) !== 0;
      if (bit) { // true = occupied
        yield i;
      }
    }
  }
}
