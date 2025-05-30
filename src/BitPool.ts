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
      const baseIndex = i << 5;

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

    // Initialize all data and hierarchy bits as available
    this.fill(0xFFFFFFFF);

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
  static findFirstSetBit(value: number): number {
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
    // Fast path: when nextAvailableHierarchyIndex is 0, try first word directly if it has bits
    if (this.#nextAvailableHierarchyIndex === 0) {
      const firstWord = this[0];
      if (firstWord !== undefined && firstWord !== 0) {
        // Use optimized bit scanning for first word
        const bitPos = firstWord & 1 ? 0 : BitPool.findFirstSetBit(firstWord);
        if (bitPos !== -1 && bitPos < this.#actualSize) {
          const newValue = firstWord & ~(1 << bitPos);
          this[0] = newValue;

          // Update hierarchy only if word becomes empty
          if (newValue === 0) {
            // Inline hierarchy operations for index 0
            const hierarchyWordIndex = this.#hierarchyStartIndex;
            const currentHierarchyWord = this[hierarchyWordIndex];
            if (currentHierarchyWord !== undefined) {
              const newHierarchyWord = currentHierarchyWord & ~1;
              this[hierarchyWordIndex] = newHierarchyWord;

              if (newHierarchyWord === 0) {
                this.#nextAvailableHierarchyIndex = this.#findNextAvailableHierarchyIndex(1);
              }
            }
          }

          return bitPos;
        }
      }
    }

    // Standard path: Start from the known available hierarchy index
    let hierarchyIdx = this.#nextAvailableHierarchyIndex;

    while (hierarchyIdx < this.#hierarchyLength) {
      const hierarchyWord = this.getHierarchyWord(hierarchyIdx);

      if (hierarchyWord === 0) {
        // No available chunks in this hierarchy word, move to next
        hierarchyIdx++;
        continue;
      }

      // Find first available chunk using bit scanning
      const hierarchyBitPos = BitPool.findFirstSetBit(hierarchyWord);
      if (hierarchyBitPos === -1) {
        hierarchyIdx++;
        continue;
      }

      const dataWordIdx = (hierarchyIdx << 5) + hierarchyBitPos;

      // Check if we're beyond the data section
      if (dataWordIdx >= this.#hierarchyStartIndex) break;

      const dataWord = this[dataWordIdx];
      if (dataWord === undefined || dataWord === 0) {
        // Data word is actually full, update hierarchy and continue
        this.#setHierarchyWord(hierarchyIdx, hierarchyWord & ~(1 << hierarchyBitPos));
        continue;
      }

      // Find first available bit in the data word
      const dataBitPos = BitPool.findFirstSetBit(dataWord);
      if (dataBitPos === -1) {
        // Data word is actually full, update hierarchy and continue
        this.#setHierarchyWord(hierarchyIdx, hierarchyWord & ~(1 << hierarchyBitPos));
        continue;
      }

      const absolutePosition = (dataWordIdx << 5) + dataBitPos;

      // Check if position is within actual size
      if (absolutePosition >= this.#actualSize) {
        // Update hierarchy to mark this chunk as unavailable
        this.#setHierarchyWord(hierarchyIdx, hierarchyWord & ~(1 << hierarchyBitPos));
        continue;
      }

      // Acquire the bit
      const newDataWord = dataWord & ~(1 << dataBitPos);
      this[dataWordIdx] = newDataWord;

      // Update hierarchy if data word becomes empty
      if (newDataWord === 0) {
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
    const hierarchyStart = this.#hierarchyStartIndex;
    const hierarchyLength = this.#hierarchyLength;

    for (let h = 0; h < hierarchyLength; h++) {
      let hierarchyWord = 0;
      const baseDataWordIdx = h << 5; // Optimized: h * 32

      for (let b = 0; b < BooleanArray.BITS_PER_INT; b++) {
        const dataWordIdx = baseDataWordIdx + b;
        if (dataWordIdx >= hierarchyStart) break;

        const dataValue = this[dataWordIdx];
        if (dataValue !== undefined && dataValue !== 0) {
          hierarchyWord |= 1 << b;
        }
      }
      this[hierarchyStart + h] = hierarchyWord;
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

  /**
   * Get the indices of the set bits in the array
   * @param startIndex the start index to get the indices from [default = 0]
   * @param endIndex the end index to get the indices from [default = this.size]
   * @returns Iterator of indices where bits are set
   */
  override *truthyIndices(startIndex = 0, endIndex = this.#actualSize): IterableIterator<number> {
    // Validate and adjust range
    startIndex = Math.max(0, startIndex);
    endIndex = Math.min(endIndex, this.#actualSize);

    if (startIndex >= endIndex) return;

    // Calculate word boundaries
    const startWord = Math.floor(startIndex / BooleanArray.BITS_PER_INT);
    const endWord = Math.floor((endIndex - 1) / BooleanArray.BITS_PER_INT);

    for (let wordIndex = startWord; wordIndex <= endWord; wordIndex++) {
      const word = this[wordIndex];
      if (word === undefined || word === 0) continue;

      // Calculate bit range for this word
      const firstBit = wordIndex === startWord ? startIndex % BooleanArray.BITS_PER_INT : 0;
      const lastBit = wordIndex === endWord
        ? (endIndex - 1) % BooleanArray.BITS_PER_INT
        : BooleanArray.BITS_PER_INT - 1;

      // Check each bit in the word
      for (let bitPos = firstBit; bitPos <= lastBit; bitPos++) {
        if ((word & (1 << bitPos)) !== 0) {
          yield wordIndex * BooleanArray.BITS_PER_INT + bitPos;
        }
      }
    }
  }

  /**
   * Get the boolean state of a bit
   * @param index the bit index to get the state of
   * @returns the boolean state of the bit
   */
  override getBool(index: number): boolean {
    BooleanArray.validateValue(index, this.#actualSize);
    return (this[index >>> BooleanArray.CHUNK_SHIFT]! & (1 << (index & BooleanArray.CHUNK_MASK))) !== 0;
  }

  /**
   * Get bulk boolean values for better performance
   * @param startIndex the start index to get the booleans from
   * @param count the number of booleans to get
   * @returns an array of booleans
   */
  override getBools(startIndex: number, count: number): boolean[] {
    BooleanArray.validateValue(startIndex, this.#actualSize);
    BooleanArray.validateValue(startIndex + count, this.#actualSize + 1);
    const result: boolean[] = new Array(count);
    if (count === 0) return result;

    let currentChunkIndex = -1;
    let currentChunkValue = 0;

    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      const chunkForThisBit = index >>> BooleanArray.CHUNK_SHIFT;
      if (chunkForThisBit !== currentChunkIndex) {
        currentChunkIndex = chunkForThisBit;
        currentChunkValue = this[currentChunkIndex]!;
      }
      const offset = index & BooleanArray.CHUNK_MASK;
      result[i] = (currentChunkValue & (1 << offset)) !== 0;
    }
    return result;
  }

  /**
   * Set the boolean state of a bit
   * @param index the bit index to set the state of
   * @param value the boolean state to set the bit to
   * @returns `this` for chaining
   */
  override setBool(index: number, value: boolean): this {
    BooleanArray.validateValue(index, this.#actualSize);
    const chunk = index >>> BooleanArray.CHUNK_SHIFT;
    const mask = 1 << (index & BooleanArray.CHUNK_MASK);

    const wasEmpty = this[chunk] === 0;

    if (value) {
      this[chunk]! |= mask;
    } else {
      this[chunk]! &= ~mask;
    }

    // Update hierarchy if word state changed between empty/non-empty
    const isNowEmpty = this[chunk] === 0;
    if (wasEmpty !== isNowEmpty) {
      const hierarchyIdx = Math.floor(chunk / BooleanArray.BITS_PER_INT);
      const hierarchyBitPos = chunk % BooleanArray.BITS_PER_INT;

      if (hierarchyIdx < this.#hierarchyLength) {
        const hierarchyWord = this.getHierarchyWord(hierarchyIdx);
        if (isNowEmpty) {
          // Word became empty, clear hierarchy bit
          this.#setHierarchyWord(hierarchyIdx, hierarchyWord & ~(1 << hierarchyBitPos));
        } else {
          // Word became non-empty, set hierarchy bit
          this.#setHierarchyWord(hierarchyIdx, hierarchyWord | (1 << hierarchyBitPos));
          // Update next available hierarchy index if this makes an earlier position available
          if (hierarchyIdx < this.#nextAvailableHierarchyIndex) {
            this.#nextAvailableHierarchyIndex = hierarchyIdx;
          }
        }
      }
    }

    return this;
  }

  /**
   * Set a range of bits to a given value
   * @param startIndex the start index to set the range from
   * @param count the number of booleans to set
   * @param value the boolean value to set
   * @returns `this` for chaining
   */
  override setRange(startIndex: number, count: number, value: boolean): this {
    if (count === 0) return this;

    BooleanArray.validateValue(startIndex, this.#actualSize);
    BooleanArray.validateValue(startIndex + count, this.#actualSize + 1);

    const endIndex = startIndex + count - 1;
    const startChunk = startIndex >>> BooleanArray.CHUNK_SHIFT;
    const endChunk = endIndex >>> BooleanArray.CHUNK_SHIFT;

    // First pass: update data chunks and track hierarchy range
    let minHierarchyIdx = this.#hierarchyLength;
    let maxHierarchyIdx = -1;

    for (let chunkIdx = startChunk; chunkIdx <= endChunk; chunkIdx++) {
      const wasEmpty = this[chunkIdx] === 0;

      // Calculate bit range for this chunk
      const firstBit = chunkIdx === startChunk ? startIndex & BooleanArray.CHUNK_MASK : 0;
      const lastBit = chunkIdx === endChunk ? endIndex & BooleanArray.CHUNK_MASK : BooleanArray.CHUNK_MASK;

      // Create mask for the bits to modify
      const bitCount = lastBit - firstBit + 1;
      const mask = bitCount === BooleanArray.BITS_PER_INT
        ? BooleanArray.ALL_BITS
        : (((1 << bitCount) - 1) << firstBit) >>> 0;

      if (value) {
        this[chunkIdx]! |= mask;
      } else {
        this[chunkIdx]! &= ~mask;
      }

      const isNowEmpty = this[chunkIdx] === 0;

      // Track hierarchy range that needs updating
      if (wasEmpty !== isNowEmpty) {
        const hierarchyIdx = Math.floor(chunkIdx / BooleanArray.BITS_PER_INT);
        if (hierarchyIdx < this.#hierarchyLength) {
          minHierarchyIdx = Math.min(minHierarchyIdx, hierarchyIdx);
          maxHierarchyIdx = Math.max(maxHierarchyIdx, hierarchyIdx);
        }
      }
    }

    // Second pass: update only the hierarchy words that changed
    for (let hierarchyIdx = minHierarchyIdx; hierarchyIdx <= maxHierarchyIdx; hierarchyIdx++) {
      let newHierarchyWord = 0;

      const baseDataWordIdx = hierarchyIdx << 5;
      for (let b = 0; b < BooleanArray.BITS_PER_INT; b++) {
        const dataWordIdx = baseDataWordIdx + b;
        if (dataWordIdx >= this.#hierarchyStartIndex) break;

        if (this[dataWordIdx] !== 0) {
          newHierarchyWord |= 1 << b;
        }
      }

      this.#setHierarchyWord(hierarchyIdx, newHierarchyWord);

      // Update next available hierarchy index if needed
      if (newHierarchyWord !== 0 && hierarchyIdx < this.#nextAvailableHierarchyIndex) {
        this.#nextAvailableHierarchyIndex = hierarchyIdx;
      }
    }

    return this;
  }

  /**
   * Toggle the boolean state of a bit
   * @param index the bit index to toggle the state of
   * @returns the new boolean state of the bit
   */
  override toggleBool(index: number): boolean {
    BooleanArray.validateValue(index, this.#actualSize);
    const chunk = index >>> BooleanArray.CHUNK_SHIFT;
    const mask = 1 << (index & BooleanArray.CHUNK_MASK);

    const wasEmpty = this[chunk] === 0;
    this[chunk]! ^= mask;
    const isNowEmpty = this[chunk] === 0;
    const newValue = (this[chunk]! & mask) !== 0;

    // Update hierarchy if word state changed between empty/non-empty
    if (wasEmpty !== isNowEmpty) {
      const hierarchyIdx = Math.floor(chunk / BooleanArray.BITS_PER_INT);
      const hierarchyBitPos = chunk % BooleanArray.BITS_PER_INT;

      if (hierarchyIdx < this.#hierarchyLength) {
        const hierarchyWord = this.getHierarchyWord(hierarchyIdx);
        if (isNowEmpty) {
          this.#setHierarchyWord(hierarchyIdx, hierarchyWord & ~(1 << hierarchyBitPos));
        } else {
          this.#setHierarchyWord(hierarchyIdx, hierarchyWord | (1 << hierarchyBitPos));
          if (hierarchyIdx < this.#nextAvailableHierarchyIndex) {
            this.#nextAvailableHierarchyIndex = hierarchyIdx;
          }
        }
      }
    }

    return newValue;
  }

  /**
   * Iterates over each bit in the data portion of the array
   * @param callback the callback to execute for each bit
   * @param startIndex the start index to iterate from [default = 0]
   * @param count the number of booleans to iterate over [default = this.size - startIndex]
   * @returns the current BitPool
   */
  override forEachBool(
    callback: (index: number, value: boolean, array: this) => void,
    startIndex: number = 0,
    count: number = this.#actualSize - startIndex,
  ): this {
    if (count === 0) return this;
    BooleanArray.validateValue(startIndex, this.#actualSize);
    BooleanArray.validateValue(startIndex + count, this.#actualSize + 1);

    let currentChunkIndex = -1;
    let currentChunkValue = 0;

    const endIndex = startIndex + count;
    for (let i = startIndex; i < endIndex; i++) {
      const chunkForThisBit = i >>> BooleanArray.CHUNK_SHIFT;
      if (chunkForThisBit !== currentChunkIndex) {
        currentChunkIndex = chunkForThisBit;
        currentChunkValue = this[currentChunkIndex]!;
      }
      const offset = i & BooleanArray.CHUNK_MASK;
      callback(i, (currentChunkValue & (1 << offset)) !== 0, this);
    }
    return this;
  }

  /**
   * Get the index of the first set bit starting from a given index (only searches data portion)
   * @param startIndex the index to start searching from [default = 0]
   * @returns the index of the first set bit, or -1 if no bits are set
   */
  override getFirstSetIndex(startIndex: number = 0): number {
    BooleanArray.validateValue(startIndex, this.#actualSize);

    const startChunk = startIndex >>> BooleanArray.CHUNK_SHIFT;
    const startOffset = startIndex & BooleanArray.CHUNK_MASK;
    const maxChunk = Math.floor((this.#actualSize - 1) / BooleanArray.BITS_PER_INT);

    // Handle first chunk with mask for bits after startOffset
    if (startChunk <= maxChunk) {
      const firstChunkMask = (BooleanArray.ALL_BITS << startOffset) >>> 0;
      const firstChunk = this[startChunk]! & firstChunkMask;
      if (firstChunk !== 0) {
        const bitPos = Math.clz32(firstChunk & -firstChunk) ^ 31;
        const index = (startChunk << BooleanArray.CHUNK_SHIFT) + bitPos;
        return index < this.#actualSize ? index : -1;
      }
    }

    // Search remaining chunks (only in data portion)
    for (let i = startChunk + 1; i <= maxChunk; i++) {
      const chunk = this[i]!;
      if (chunk !== 0) {
        const bitPos = Math.clz32(chunk & -chunk) ^ 31;
        const index = (i << BooleanArray.CHUNK_SHIFT) + bitPos;
        return index < this.#actualSize ? index : -1;
      }
    }

    return -1;
  }

  /**
   * Get the index of the last set bit (only searches data portion)
   * @param startIndex the index to start searching from (exclusive upper bound) [default = this.size]
   * @returns the index of the last set bit, or -1 if no bits are set in the specified range
   */
  override getLastSetIndex(startIndex: number = this.#actualSize): number {
    BooleanArray.validateValue(startIndex, this.#actualSize + 1);

    if (startIndex === 0) return -1;

    const searchUpToBitIndex_inclusive = startIndex - 1;
    const startChunk = searchUpToBitIndex_inclusive >>> BooleanArray.CHUNK_SHIFT;
    const bitOffsetInStartChunk = searchUpToBitIndex_inclusive & BooleanArray.CHUNK_MASK;

    // Handle the first chunk (the one containing searchUpToBitIndex_inclusive)
    const firstChunkValue = this[startChunk]!;
    if (firstChunkValue !== 0) {
      let mask;
      if (bitOffsetInStartChunk === 31) {
        mask = BooleanArray.ALL_BITS;
      } else {
        mask = ((1 << (bitOffsetInStartChunk + 1)) - 1) >>> 0;
      }
      const maskedChunk = firstChunkValue & mask;
      if (maskedChunk !== 0) {
        const bitPos = 31 - Math.clz32(maskedChunk);
        return (startChunk << BooleanArray.CHUNK_SHIFT) + bitPos;
      }
    }

    // Search remaining chunks backwards (only in data portion)
    for (let i = startChunk - 1; i >= 0; i--) {
      const chunkValue = this[i]!;
      if (chunkValue !== 0) {
        const bitPos = 31 - Math.clz32(chunkValue);
        return (i << BooleanArray.CHUNK_SHIFT) + bitPos;
      }
    }

    return -1;
  }

  /**
   * Get the number of set bits in the data portion of the array
   * @returns the number of set bits in the data portion
   */
  override getPopulationCount(): number {
    let count = 0;
    const maxDataChunk = Math.floor((this.#actualSize - 1) / BooleanArray.BITS_PER_INT);

    // Count all full data chunks
    for (let i = 0; i < maxDataChunk; i++) {
      let value = this[i]!;
      value = value - ((value >>> 1) & 0x55555555);
      value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
      value = (value + (value >>> 4)) & 0x0f0f0f0f;
      count += (value * 0x01010101) >>> 24;
    }

    // Handle last data chunk if it exists
    if (maxDataChunk >= 0 && maxDataChunk < this.#hierarchyStartIndex) {
      const remainingBits = this.#actualSize % 32;
      const lastChunkMask = remainingBits === 0 ? 4294967295 : ((1 << remainingBits) - 1) >>> 0;
      let value = this[maxDataChunk]! & lastChunkMask;
      value = value - ((value >>> 1) & 0x55555555);
      value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
      value = (value + (value >>> 4)) & 0x0f0f0f0f;
      count += (value * 0x01010101) >>> 24;
    }

    return count;
  }

  /**
   * Check if the data portion of the array is empty
   * @returns `true` if the data portion is empty, `false` otherwise
   */
  override isEmpty(): boolean {
    const maxDataChunk = Math.floor((this.#actualSize - 1) / BooleanArray.BITS_PER_INT);

    for (let i = 0; i <= maxDataChunk && i < this.#hierarchyStartIndex; i++) {
      if (this[i] !== 0) return false;
    }

    return true;
  }

  /**
   * Creates a copy of this BitPool
   * @returns a new BitPool with the same data contents
   */
  override clone(): BitPool {
    const copy = new BitPool(this.#actualSize);

    // Copy only the data portion
    for (let i = 0; i < this.#hierarchyStartIndex; i++) {
      copy[i] = this[i]!;
    }

    // Rebuild the hierarchy for the copy
    copy.refresh();

    return copy;
  }

  /**
   * Clear all allocations (marks all bits as occupied/unavailable)
   * @returns `this` for chaining
   */
  override clear(): this {
    // Clear only the data portion (mark as occupied)
    for (let i = 0; i < this.#hierarchyStartIndex; i++) {
      this[i] = 0;
    }

    // Clear the hierarchy
    for (let i = 0; i < this.#hierarchyLength; i++) {
      this.#setHierarchyWord(i, 0);
    }

    this.#nextAvailableHierarchyIndex = this.#hierarchyLength;

    return this;
  }

  /**
   * Set all bits in the data portion to `true` (marks all bits as available)
   * @returns `this` for chaining
   */
  override setAll(): this {
    // Set all data chunks to ALL_BITS
    for (let i = 0; i < this.#hierarchyStartIndex; i++) {
      this[i] = BooleanArray.ALL_BITS;
    }

    // Mask off any excess bits in the last data chunk if needed
    const remainingBits = this.#actualSize % BooleanArray.BITS_PER_INT;
    if (remainingBits > 0) {
      const lastIndex = this.#hierarchyStartIndex - 1;
      const mask = ((1 << remainingBits) - 1) >>> 0;
      this[lastIndex] = mask;
    }

    // Rebuild hierarchy
    this.#rebuildHierarchy();
    this.#nextAvailableHierarchyIndex = this.#findNextAvailableHierarchyIndex(0);

    return this;
  }

  /**
   * @deprecated
   * Bitwise operations are not supported on BitPool as they would corrupt the hierarchy.
   * Use refresh() after direct array manipulation if needed.
   */
  override and(): this {
    throw new Error(
      "Bitwise operations are not supported on BitPool. Use acquire()/release() or call refresh() after direct manipulation.",
    );
  }

  /**
   * @deprecated
   * Bitwise operations are not supported on BitPool as they would corrupt the hierarchy.
   * Use refresh() after direct array manipulation if needed.
   */
  override or(): this {
    throw new Error(
      "Bitwise operations are not supported on BitPool. Use acquire()/release() or call refresh() after direct manipulation.",
    );
  }

  /**
   * @deprecated
   * Bitwise operations are not supported on BitPool as they would corrupt the hierarchy.
   * Use refresh() after direct array manipulation if needed.
   */
  override xor(): this {
    throw new Error(
      "Bitwise operations are not supported on BitPool. Use acquire()/release() or call refresh() after direct manipulation.",
    );
  }

  /**
   * @deprecated
   * Bitwise operations are not supported on BitPool as they would corrupt the hierarchy.
   * Use refresh() after direct array manipulation if needed.
   */
  override nand(): this {
    throw new Error(
      "Bitwise operations are not supported on BitPool. Use acquire()/release() or call refresh() after direct manipulation.",
    );
  }

  /**
   * @deprecated
   * Bitwise operations are not supported on BitPool as they would corrupt the hierarchy.
   * Use refresh() after direct array manipulation if needed.
   */
  override nor(): this {
    throw new Error(
      "Bitwise operations are not supported on BitPool. Use acquire()/release() or call refresh() after direct manipulation.",
    );
  }

  /**
   * @deprecated
   * Bitwise operations are not supported on BitPool as they would corrupt the hierarchy.
   * Use refresh() after direct array manipulation if needed.
   */
  override not(): this {
    throw new Error(
      "Bitwise operations are not supported on BitPool. Use acquire()/release() or call refresh() after direct manipulation.",
    );
  }

  /**
   * @deprecated
   * Bitwise operations are not supported on BitPool as they would corrupt the hierarchy.
   * Use refresh() after direct array manipulation if needed.
   */
  override difference(): this {
    throw new Error(
      "Bitwise operations are not supported on BitPool. Use acquire()/release() or call refresh() after direct manipulation.",
    );
  }

  /**
   * @deprecated
   * Bitwise operations are not supported on BitPool as they would corrupt the hierarchy.
   * Use refresh() after direct array manipulation if needed.
   */
  override xnor(): this {
    throw new Error(
      "Bitwise operations are not supported on BitPool. Use acquire()/release() or call refresh() after direct manipulation.",
    );
  }
}
