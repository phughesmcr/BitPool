/**
 * @module BitPool
 * @description A pool of single bits backed by a Uint32Array.
 * @copyright 2024 the BitPool authors. All rights reserved.
 * @license MIT
 */

import { BooleanArray } from "@phughesmcr/booleanarray";

/** Convenience function to check if a value is greater than zero */
function isGreaterThanZero(value: number): boolean {
  return value > 0;
}

/**
 * A pool of single bits backed by a Uint32Array.
 */
export class BitPool extends BooleanArray {
  /** The next available index in the bitpool */
  #nextAvailableIndex: number;

  /**
   * Creates a new Bitpool from an array of numbers
   * @param arr The array of numbers to create the Bitpool from
   * @param capacity The capacity of the Bitpool
   * @returns a new Bitpool
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
      if (typeof value !== "number" || !Number.isSafeInteger(value)) {
        throw new TypeError('"value" must be a safe integer');
      }
      if (value < 0) {
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
   * Creates a new Bitpool with the specified capacity
   *
   * @param size The number of slots in the bitpool
   * @returns A new Bitpool instance.
   * @throws {RangeError} if `size` is less than 1, or is greater than 0xffffffff (2 ** 32 - 1) === (4294967295)
   * @throws {TypeError} if `size` is NaN
   */
  constructor(size: number) {
    if (size <= 0) {
      throw new RangeError('"size" must be greater than 0');
    }
    super(size);
    this.setAll();
    this.#nextAvailableIndex = 0;
  }

  /** The next available index in the bitpool */
  get nextAvailableIndex(): number {
    return this.#nextAvailableIndex;
  }

  /**
   * @returns `true` if a given bit is currently acquired
   * @throws {RangeError} if `bit` is not found
   * @throws {TypeError} if `bit` is NaN
   */
  isOccupied(bit: number): boolean {
    return !this.getBool(bit);
  }

  /**
   * Acquires an available bit in the Bitpool, setting it to '0'
   * @returns The acquired bit's position or -1 if no bits are available
   */
  acquire(): number {
    let currentIdx = this.nextAvailableIndex;

    while (currentIdx < this.length) {
      const value = this[currentIdx];
      if (value === undefined || value === 0) {
        currentIdx++;
        continue;
      }

      const maxBitsInChunk = Math.min(
        BooleanArray.BITS_PER_INT,
        this.size - (currentIdx * BooleanArray.BITS_PER_INT),
      );

      for (let i = 0; i < maxBitsInChunk; i++) {
        if ((value & (1 << i)) !== 0) {
          const absolutePosition = currentIdx * BooleanArray.BITS_PER_INT + i;
          if (absolutePosition >= this.size) {
            return -1;
          }

          // Clear the bit
          this[currentIdx] = value & ~(1 << i);

          // Update next available index if needed
          if (this[currentIdx] === 0) {
            this.#nextAvailableIndex = this.findIndex(
              (v, idx) => idx > currentIdx && v > 0,
            );
            if (this.#nextAvailableIndex === -1) {
              this.#nextAvailableIndex = this.length;
            }
          }

          return absolutePosition;
        }
      }

      currentIdx++;
    }

    return -1;
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
      if (nextAvailableIndex < 0 || nextAvailableIndex >= this.length) {
        throw new RangeError(
          `"nextAvailableIndex" must be within the bounds of the Bitpool (Between 0 and ${this.length - 1})`,
        );
      }
      // If the chunk at the specified index has available bits, update the nextAvailableIndex
      if (this[nextAvailableIndex] !== 0) {
        this.#nextAvailableIndex = nextAvailableIndex;
        return this;
      }
    }
    // Fallback to finding the next available index using the default findIndex function
    const foundIndex = this.findIndex(isGreaterThanZero);
    this.#nextAvailableIndex = foundIndex === -1 ? this.length : foundIndex;
    return this;
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

    const index = Math.floor(value / BooleanArray.BITS_PER_INT);
    const position = value % BooleanArray.BITS_PER_INT;

    if (index < 0 || index >= this.length || value >= this.size) {
      return this;
    }

    // Set the bit back to 1 - index is guaranteed to be valid here
    const currentValue = this[index];
    if (currentValue !== undefined) {
      this[index] = currentValue | (1 << position);
    }

    // Update nextAvailableIndex if we're releasing a bit in an earlier chunk
    if (index < this.#nextAvailableIndex) {
      this.#nextAvailableIndex = index;
    }

    return this;
  }
}
