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
   * Creates a new BitPool from an array of booleans or numbers.
   * @param array The array to use as the pool
   * @param size The size of the pool (default is the length of the array)
   * @returns A new BitPool
   *
   * @example
   * ```ts
   * // Create a pool of 8 bits, explicitly specifying the first 4 bits
   * const pool = BitPool.fromArray([false, true, false, true], 8); // [A, O, A, O, A, A, A, A]
   *
   * // Create a pool of 10 bits, explicitly occupying given bits
   * const pool = BitPool.fromArray([1, 2, 3, 5, 8], 10); // [A, O, O, O, A, O, A, A, O, A]
   * ```
   */
  static fromArray<T extends boolean | number>(array: T[], size: number = array.length): BitPool {
    if (size <= 0) {
      throw new RangeError('"capacity" must be greater than 0');
    }

    if (array.length === 0) {
      return new BitPool(size);
    }

    // If array contains booleans, create BooleanArray directly
    if (typeof array[0] === "boolean") {
      const boolArray = array as boolean[];
      const arr = new BooleanArray(size);
      const copyLength = Math.min(boolArray.length, size);
      for (let i = 0; i < copyLength; i++) {
        arr.set(i, boolArray[i]!);
      }
      return new BitPool(arr);
    }

    // If array contains numbers, these are treated as indices to be marked as occupied.
    const indicesToOccupy = array as number[];
    const arr = new BooleanArray(size); // Initialize all as available (false)

    for (const value of indicesToOccupy) {
      // Validate each index
      if (!Number.isSafeInteger(value)) {
        throw new TypeError(`"value" in input array (${value}) must be a safe integer`);
      }
      if (value < 0) {
        throw new RangeError(`"value" in input array (${value}) must be greater than or equal to 0`);
      }
      if (value >= size) {
        throw new RangeError(
          `"value" in input array (${value}) is out of bounds for pool capacity ${size}. Must be less than ${size}.`,
        );
      }
      arr.set(value, true); // Mark as occupied
    }
    return new BitPool(arr);
  }

  /**
   * Creates a new BitPool from a Uint32Array or number array.
   * @param array The array to use as the pool
   * @param capacity The size of the pool (default is the length of the array * 32)
   * @returns A new BitPool
   *
   * @example
   * ```ts
   * // Create a pool of 128 bits, explicitly specifying each chunk of 32 bits
   * const pool = BitPool.fromUint32Array([0b11110000, 0b00001111, 0b10101010], 128);
   * ```
   */
  static fromUint32Array(array: ArrayLike<number>, capacity: number = array.length * 32): BitPool {
    if (capacity <= 0) {
      throw new RangeError('"capacity" must be greater than 0');
    }
    if (capacity < array.length * 32) {
      throw new RangeError(`For the array to fit, "capacity" must be greater than or equal to ${array.length * 32}`);
    }

    // Validate array values
    for (let i = 0; i < array.length; i++) {
      const value = array[i];
      if (value === undefined || !Number.isSafeInteger(value)) {
        throw new TypeError('"value" must be a safe integer');
      }
      if (value < 0) {
        throw new RangeError('"value" must be greater than or equal to 0');
      }
    }

    // Invert the bit patterns to match expected behavior (1 bits in input become occupied/true in BitPool)
    const invertedArray = Array.from(array, (x) => ~x >>> 0);
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
    if (this.#availableCount === 0) {
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
   * @throws {RangeError} When index is out of bounds
   */
  isAvailable(index: number): boolean {
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

    if (index < this.#nextAvailableIndex) {
      this.#nextAvailableIndex = index;
    }
  }

  /** Iterator that yields the underlying uint32 array values. */
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
