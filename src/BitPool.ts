/**
 * @module BitPool
 * @description A pool of single bits backed by a Uint32Array.
 * @copyright 2024 the BitPool authors. All rights reserved.
 * @license MIT
 */

import { BooleanArray } from "@phughesmcr/booleanarray";

/**
 * A pool of single bits backed by a Uint32Array.
 */
export class BitPool extends BooleanArray {
  /** The next available index in the bitpool */
  #nextAvailableIndex: number;

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
      throw new RangeError('"value" must be greater than 0');
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

    // Set the bit back to 1
    this[index]! |= 1 << position;

    // Update nextAvailableIndex if we're releasing a bit in an earlier chunk
    if (index < this.#nextAvailableIndex) {
      this.#nextAvailableIndex = index;
    }

    return this;
  }
}
