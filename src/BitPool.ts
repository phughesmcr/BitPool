/**
 * @module BitPool
 * @description A high-performance BitPool with embedded hierarchy that avoids GC allocations.
 * @copyright 2025 the BitPool authors. All rights reserved.
 * @license MIT
 */

import { BooleanArray } from "@phughesmcr/booleanarray";

/**
 * A high-performance pool of single bits with embedded hierarchy to avoid GC allocations.
 * The hierarchy is stored at the end of the main array to provide O(log n) performance
 * without creating additional TypedArray objects.
 */
export class BitPool extends BooleanArray {
  /** The actual size of the bitpool (excluding hierarchy space) */
  #actualSize: number;

  /** The index where hierarchy data starts in the array */
  #hierarchyStartIndex: number;

  /** The number of words used for hierarchy */
  #hierarchyLength: number;

  /** The next available hierarchy word to check */
  #nextAvailableHierarchyIndex: number;

  /**
   * Maximum safe size for BitPool accounting for hierarchy overhead.
   * This ensures the total size (data + hierarchy) doesn't exceed BooleanArray.MAX_SAFE_SIZE.
   */
  static get MAX_SAFE_BITPOOL_SIZE(): number {
    // Calculate the maximum size where total words (data + hierarchy) <= BooleanArray max words
    const maxTotalWords = Math.floor(BooleanArray.MAX_SAFE_SIZE / BooleanArray.BITS_PER_INT);

    // Solve: dataWords + Math.ceil(dataWords / 32) <= maxTotalWords
    // In worst case: dataWords * (1 + 1/32) + 1 <= maxTotalWords
    // So: dataWords <= (maxTotalWords - 1) * 32 / 33
    const maxDataWords = Math.floor((maxTotalWords - 1) * BooleanArray.BITS_PER_INT / (BooleanArray.BITS_PER_INT + 1));

    return maxDataWords * BooleanArray.BITS_PER_INT;
  }

  /**
   * Creates a new BitPool from an array of numbers
   * @param arr The array of numbers to create the Bitpool from
   * @param capacity The capacity of the Bitpool
   * @returns a new BitPool
   */
  static override fromArray(arr: number[], capacity: number): BitPool {
    if (capacity <= 0) {
      throw new RangeError('"capacity" must be greater than 0');
    }
    if (capacity < arr.length * BooleanArray.BITS_PER_INT) {
      throw new RangeError(
        `For the array to fit, "capacity" must be greater than or equal to ${arr.length * BooleanArray.BITS_PER_INT}`,
      );
    }

    const pool = new BitPool(capacity);

    // Set all bits to 1 initially (available)
    pool.setAll();

    for (let i = 0; i < arr.length; i++) {
      const value = arr[i];

      // Validate each value
      if (!Number.isSafeInteger(value)) {
        throw new TypeError('"value" must be a safe integer');
      }
      if (value === undefined || value < 0) {
        throw new RangeError('"value" must be greater than or equal to 0');
      }

      // Each value represents a 32-bit chunk
      const baseIndex = i * BooleanArray.BITS_PER_INT;

      // For each bit in the current value
      for (let bitPos = 0; bitPos < BooleanArray.BITS_PER_INT; bitPos++) {
        const absolutePosition = baseIndex + bitPos;
        if (absolutePosition >= capacity) break;

        // If the bit is 0 in the input, mark it as occupied (false in our pool)
        if ((value & (1 << bitPos)) === 0) {
          pool.setBool(absolutePosition, false);
        }
      }
    }

    pool.refresh();
    return pool;
  }

  /**
   * Creates a new BitPool with the specified capacity
   *
   * @param size The number of slots in the bitpool
   * @returns A new BitPool instance.
   * @throws {RangeError} if `size` is less than 1, or is greater than 0xffffffff (2 ** 32 - 1) === (4294967295)
   * @throws {TypeError} if `size` is NaN
   */
  constructor(size: number) {
    if (size <= 0) {
      throw new RangeError('"size" must be greater than 0');
    }

    // Calculate space needed for hierarchy
    const dataWords = Math.ceil(size / BooleanArray.BITS_PER_INT);
    const hierarchyWords = Math.ceil(dataWords / BooleanArray.BITS_PER_INT);

    // Allocate single array with hierarchy embedded at the end
    const totalWords = dataWords + hierarchyWords;
    const totalBits = totalWords * BooleanArray.BITS_PER_INT;

    super(totalBits);

    this.#actualSize = size;
    this.#hierarchyStartIndex = dataWords;
    this.#hierarchyLength = hierarchyWords;
    this.#nextAvailableHierarchyIndex = 0;

    // Initialize all data bits as available
    for (let i = 0; i < dataWords; i++) {
      this[i] = 0xFFFFFFFF;
    }

    // Initialize all hierarchy bits as available
    for (let i = 0; i < hierarchyWords; i++) {
      this[this.#hierarchyStartIndex + i] = 0xFFFFFFFF;
    }

    // Handle partial words at the end
    this.#maskUnusedBits();
  }

  /** The actual size of the bitpool (excluding hierarchy space) */
  override get size(): number {
    return this.#actualSize;
  }

  /** The next available index in the bitpool */
  get nextAvailableIndex(): number {
    return this.#nextAvailableHierarchyIndex * BooleanArray.BITS_PER_INT;
  }

  /**
   * Gets a hierarchy word at the specified index
   * @param index The hierarchy word index
   * @returns The hierarchy word value
   */
  getHierarchyWord(index: number): number {
    if (index >= this.#hierarchyLength) return 0;
    const value = this[this.#hierarchyStartIndex + index];
    return value !== undefined ? value : 0;
  }

  /**
   * Sets a hierarchy word at the specified index
   * @param index The hierarchy word index
   * @param value The value to set
   */
  #setHierarchyWord(index: number, value: number): void {
    if (index < this.#hierarchyLength) {
      this[this.#hierarchyStartIndex + index] = value;
    }
  }

  /**
   * Finds the first set bit in a 32-bit integer using bit manipulation
   * @param value The value to scan
   * @returns The position of the first set bit, or -1 if no bits are set
   */
  findFirstSetBit(value: number): number {
    if (value === 0) return -1;
    return 31 - Math.clz32(value & -value);
  }

  /**
   * Masks unused bits in partial words to ensure they don't interfere with operations
   */
  #maskUnusedBits(): void {
    // Mask unused bits in the last data word
    const lastDataWordIndex = Math.floor((this.#actualSize - 1) / BooleanArray.BITS_PER_INT);
    const usedBitsInLastWord = this.#actualSize % BooleanArray.BITS_PER_INT;

    if (usedBitsInLastWord > 0) {
      const mask = (1 << usedBitsInLastWord) - 1;
      const currentValue = this[lastDataWordIndex];
      if (currentValue !== undefined) {
        this[lastDataWordIndex] = currentValue & mask;
      }
    }

    // Mask unused bits in the last hierarchy word
    const dataWords = Math.ceil(this.#actualSize / BooleanArray.BITS_PER_INT);
    const usedHierarchyBits = dataWords % BooleanArray.BITS_PER_INT;

    if (usedHierarchyBits > 0 && this.#hierarchyLength > 0) {
      const lastHierarchyIndex = this.#hierarchyLength - 1;
      const hierarchyMask = (1 << usedHierarchyBits) - 1;
      this.#setHierarchyWord(lastHierarchyIndex, this.getHierarchyWord(lastHierarchyIndex) & hierarchyMask);
    }
  }

  /**
   * @returns `true` if a given bit is currently acquired
   * @throws {RangeError} if `bit` is not found
   * @throws {TypeError} if `bit` is NaN
   */
  isOccupied(bit: number): boolean {
    if (typeof bit !== "number" || isNaN(bit)) {
      throw new TypeError('"bit" must be a number');
    }
    if (bit < 0 || bit >= this.#actualSize) {
      throw new RangeError(`"bit" must be between 0 and ${this.#actualSize - 1}`);
    }

    const wordIndex = Math.floor(bit / BooleanArray.BITS_PER_INT);
    const bitPosition = bit % BooleanArray.BITS_PER_INT;
    const word = this[wordIndex];

    return word !== undefined && (word & (1 << bitPosition)) === 0;
  }

  /**
   * Acquires an available bit in the Bitpool, setting it to '0'
   * @returns The acquired bit's position or -1 if no bits are available
   */
  acquire(): number {
    // Start from the known available hierarchy index
    let hierarchyIdx = this.#nextAvailableHierarchyIndex;

    while (hierarchyIdx < this.#hierarchyLength) {
      const hierarchyWord = this.getHierarchyWord(hierarchyIdx);

      if (hierarchyWord === 0) {
        // No available chunks in this hierarchy word, move to next
        hierarchyIdx++;
        continue;
      }

      // Find first available chunk using bit scanning
      const hierarchyBitPos = this.findFirstSetBit(hierarchyWord);
      if (hierarchyBitPos === -1) {
        hierarchyIdx++;
        continue;
      }

      const dataWordIdx = hierarchyIdx * BooleanArray.BITS_PER_INT + hierarchyBitPos;

      // Check if we're beyond the data section
      if (dataWordIdx >= this.#hierarchyStartIndex) break;

      const dataWord = this[dataWordIdx];
      if (dataWord === undefined || dataWord === 0) {
        // Data word is actually full, update hierarchy and continue
        this.#setHierarchyWord(hierarchyIdx, hierarchyWord & ~(1 << hierarchyBitPos));
        continue;
      }

      // Find first available bit in the data word
      const dataBitPos = this.findFirstSetBit(dataWord);
      if (dataBitPos === -1) {
        // Data word is actually full, update hierarchy and continue
        this.#setHierarchyWord(hierarchyIdx, hierarchyWord & ~(1 << hierarchyBitPos));
        continue;
      }

      const absolutePosition = dataWordIdx * BooleanArray.BITS_PER_INT + dataBitPos;

      // Check if position is within actual size
      if (absolutePosition >= this.#actualSize) {
        // Update hierarchy to mark this chunk as unavailable
        this.#setHierarchyWord(hierarchyIdx, hierarchyWord & ~(1 << hierarchyBitPos));
        continue;
      }

      // Acquire the bit
      this[dataWordIdx] = dataWord & ~(1 << dataBitPos);

      // Update hierarchy if data word becomes empty
      if (this[dataWordIdx] === 0) {
        this.#setHierarchyWord(hierarchyIdx, hierarchyWord & ~(1 << hierarchyBitPos));

        // Update next available hierarchy index if this hierarchy word becomes empty
        if (this.getHierarchyWord(hierarchyIdx) === 0) {
          this.#nextAvailableHierarchyIndex = this.#findNextAvailableHierarchyIndex(hierarchyIdx + 1);
        }
      }

      return absolutePosition;
    }

    return -1; // No bits available
  }

  /**
   * Finds the next available hierarchy index starting from the given index
   * @param startIdx The index to start searching from
   * @returns The next available hierarchy index or the hierarchy length if none found
   */
  #findNextAvailableHierarchyIndex(startIdx: number): number {
    for (let i = startIdx; i < this.#hierarchyLength; i++) {
      if (this.getHierarchyWord(i) !== 0) return i;
    }
    return this.#hierarchyLength;
  }

  /**
   * Reset the nextAvailableIdx value
   * @param nextAvailableIndex The index to attempt to set the nextAvailableIdx to. Will fallback to the first available index if not available.
   * @returns the bitpool
   * @note you should probably never have to call this manually
   */
  refresh(nextAvailableIndex?: number): this {
    // If the nextAvailableIndex is provided, we need to validate it
    if (typeof nextAvailableIndex === "number") {
      if (isNaN(nextAvailableIndex)) {
        throw new TypeError('"nextAvailableIndex" must be a number');
      }

      const hierarchyIndex = Math.floor(nextAvailableIndex / BooleanArray.BITS_PER_INT);
      if (hierarchyIndex < 0 || hierarchyIndex >= this.#hierarchyLength) {
        throw new RangeError(
          `"nextAvailableIndex" must be within the bounds of the Bitpool (Between 0 and ${this.#actualSize - 1})`,
        );
      }

      // If the hierarchy word at the specified index has available chunks, update the nextAvailableIndex
      if (this.getHierarchyWord(hierarchyIndex) !== 0) {
        this.#nextAvailableHierarchyIndex = hierarchyIndex;
        return this;
      }
    }

    // Rebuild hierarchy from current state
    this.#rebuildHierarchy();

    // Find first available hierarchy index
    this.#nextAvailableHierarchyIndex = this.#findNextAvailableHierarchyIndex(0);

    return this;
  }

  /**
   * Rebuilds the hierarchy based on the current state of the data words
   */
  #rebuildHierarchy(): void {
    for (let h = 0; h < this.#hierarchyLength; h++) {
      let hierarchyWord = 0;

      for (let b = 0; b < BooleanArray.BITS_PER_INT; b++) {
        const dataWordIdx = h * BooleanArray.BITS_PER_INT + b;
        if (dataWordIdx >= this.#hierarchyStartIndex) break;

        const dataValue = this[dataWordIdx];
        if (dataValue !== undefined && dataValue !== 0) {
          hierarchyWord |= 1 << b;
        }
      }

      this.#setHierarchyWord(h, hierarchyWord);
    }
  }

  /**
   * Releases a bit in the Bitpool, setting it back to '1'
   * @param value The position of the bit to release
   * @returns The Bitpool
   * @throws {TypeError} if `value` is NaN
   */
  release(value: number): this {
    if (typeof value !== "number" || isNaN(value)) {
      throw new TypeError('"value" must be a number');
    }

    const dataWordIdx = Math.floor(value / BooleanArray.BITS_PER_INT);
    const bitPosition = value % BooleanArray.BITS_PER_INT;

    if (dataWordIdx < 0 || dataWordIdx >= this.#hierarchyStartIndex || value >= this.#actualSize) {
      return this;
    }

    const currentValue = this[dataWordIdx];
    if (currentValue === undefined) return this;

    const wasEmpty = currentValue === 0;

    // Set the bit back to 1
    this[dataWordIdx] = currentValue | (1 << bitPosition);

    // Update hierarchy if data word was previously empty
    if (wasEmpty) {
      const hierarchyIdx = Math.floor(dataWordIdx / BooleanArray.BITS_PER_INT);
      const hierarchyBitPos = dataWordIdx % BooleanArray.BITS_PER_INT;

      if (hierarchyIdx < this.#hierarchyLength) {
        const hierarchyWord = this.getHierarchyWord(hierarchyIdx);
        this.#setHierarchyWord(hierarchyIdx, hierarchyWord | (1 << hierarchyBitPos));

        // Update next available hierarchy index if this makes an earlier position available
        if (hierarchyIdx < this.#nextAvailableHierarchyIndex) {
          this.#nextAvailableHierarchyIndex = hierarchyIdx;
        }
      }
    }

    return this;
  }
}
