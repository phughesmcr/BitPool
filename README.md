# BitPool

A high-performance bit pool for managing resource allocation with efficient memory usage and fast bitwise operations.
<p align="left">
  <img src="https://badgen.net/badge/license/MIT/blue" alt="MIT License" />
  <img src="https://badgen.net/badge/icon/typescript?icon=typescript&label" alt="Written in Typescript">
  <img src="https://img.shields.io/badge/deno-^2.1.0-lightgrey?logo=deno" alt="Deno version" />
  <img src="https://img.shields.io/badge/bun-%5E1.1.0-lightgrey?logo=bun" alt="Bun version" />
  <img src="https://img.shields.io/badge/node-%5E22.0.0-lightgrey?logo=node.js" alt="Node version" />
</p>

## Features

- **High Performance**: Optimized bitwise operations with minimal GC pressure
- **Memory Efficient**: Uses `Uint32Array` backing for compact storage
- **Zero-Allocation Options**: `forEach*` and `*Into` methods avoid allocations in hot paths
- **Batch Operations**: `acquireN`, `acquireNInto`, and `releaseAll` for efficient bulk operations
- **Set Operations**: `intersect`, `union`, `difference`, and `symmetricDifference` for combining pools
- **Type Safe**: Full TypeScript support with comprehensive type definitions
- **Iterator Support**: Built-in iterators for available and occupied indices
- **Flexible Construction**: Create pools from scratch, arrays, or `Uint32Array`
- **Serialization**: `toUint32Array()` and `fromUint32Array()` for save/restore workflows
- **Large Pools**: Supports up to 536,870,911 indices (BitPool.MAX_SAFE_SIZE)

## Installation

### Node

```bash
npx jsr add @phughesmcr/bitpool
```

```ts
import { BitPool } from "@phughesmcr/bitpool";
```

### Deno

```bash
deno add jsr:@phughesmcr/bitpool
```

```ts
import { BitPool } from "@phughesmcr/bitpool";
```

### Bun

```bash
bunx jsr add @phughesmcr/bitpool
```

```ts
import { BitPool } from "@phughesmcr/bitpool";
```

## Quick Start

```ts
import { BitPool } from "@phughesmcr/bitpool";

// Create a pool with 1000 indices (0-999)
const pool = new BitPool(1000);

// Acquire resources
const id1 = pool.acquire(); // 0
const id2 = pool.acquire(); // 1

console.log(pool.isOccupied(id1)); // true
console.log(pool.availableCount); // 998

// Release resources
pool.release(id1);
pool.release(id2);

console.log(pool.isOccupied(id1)); // false
console.log(pool.availableCount); // 1000
```

## API Reference

### Constructor

#### `new BitPool(size: number)`

Creates a new BitPool with the specified size.

```ts
const pool = new BitPool(1000);
```

### Static Properties

#### `BitPool.MAX_SAFE_SIZE`

The maximum safe size of the pool (536,870,911 indices).

#### `BitPool.MAX_SAFE_VALUE`

The maximum safe value for a Uint32Array chunk (0xFFFFFFFF).

### Static Methods

#### `BitPool.fromArray(capacity: number, array: ArrayLike<number>)`

Creates a BitPool from an array of uint32 values representing bit patterns.  
Each uint32 value represents 32 bits where `1 = occupied`, `0 = available`.

```ts
// Create a pool with first 4 bits occupied
const pool = BitPool.fromArray(32, [0b00001111]);
```

#### `BitPool.fromUint32Array(capacity: number, array: ArrayLike<number>)`

Creates a BitPool from a `Uint32Array` or number array.

```ts
const mask = new Uint32Array([0xFFFF0000, 0x0000FFFF]);
const pool = BitPool.fromUint32Array(64, mask);
```

### Properties

#### `size: number`

The total size of the pool.

```ts
const pool = new BitPool(1000);
console.log(pool.size); // 1000
```

#### `availableCount: number`

The number of available slots.

```ts
console.log(pool.availableCount); // Number of free slots
```

#### `occupiedCount: number`

The number of occupied slots.

```ts
console.log(pool.occupiedCount); // Number of used slots
```

#### `nextAvailableIndex: number`

The next available index, or `-1` if the pool is full.

```ts
console.log(pool.nextAvailableIndex); // Next free index
```

#### `isEmpty: boolean`

Checks if the pool is empty (all slots available).

```ts
if (pool.isEmpty) {
  console.log("Pool is empty");
}
```

#### `isFull: boolean`

Checks if the pool is full (no slots available).

```ts
if (pool.isFull) {
  console.log("Pool is full");
}
```

### Methods

#### `acquire(): number`

Acquires the next available index. Returns `-1` if the pool is full.

```ts
const index = pool.acquire();
if (index !== -1) {
  console.log(`Acquired index ${index}`);
}
```

#### `acquireN(count: number): number[]`

Batch acquire multiple indices with all-or-nothing semantics. Throws if insufficient capacity.

```ts
const indices = pool.acquireN(10); // Acquire exactly 10 indices
// Throws RangeError if fewer than 10 are available
```

#### `acquireNInto(out: Uint32Array): number`

Zero-allocation batch acquire into a preallocated buffer. Returns count of indices actually acquired.

```ts
const buffer = new Uint32Array(100);
const count = pool.acquireNInto(buffer);
console.log(`Acquired ${count} indices`);
```

#### `release(index: number): void`

Releases an occupied index back to the pool. Uses LIFO semantics (released index becomes next available).

```ts
pool.release(index);
```

#### `releaseAll(indices: Iterable<number>): void`

Batch release multiple indices.

```ts
pool.releaseAll([0, 1, 2, 3]); // Release multiple indices
pool.releaseAll(acquiredSet);   // Works with Set, Array, or any Iterable
```

#### `isAvailable(index: number): boolean`

Checks if an index is available.

```ts
if (pool.isAvailable(42)) {
  console.log("Index 42 is available");
}
```

#### `isOccupied(index: number): boolean`

Checks if an index is occupied.

```ts
if (pool.isOccupied(42)) {
  console.log("Index 42 is occupied");
}
```

#### `findNextAvailable(startIndex?: number, loop?: boolean): number`

Finds the next available index starting from the specified index. Returns `-1` if no available indices are found.

```ts
const next = pool.findNextAvailable(100); // Start search from index 100
const looped = pool.findNextAvailable(100, true); // Loop back to start if needed
```

#### `clear(): void`

Clears the pool, making all indices available.

```ts
pool.clear();
console.log(pool.isEmpty); // true
```

#### `fill(): void`

Fills the pool, marking all indices as occupied.

```ts
pool.fill();
console.log(pool.isFull); // true
```

#### `refresh(): void`

Refreshes the pool, ensuring the next available index is set to the first available index.

```ts
pool.refresh();
```

#### `clone(): BitPool`

Creates a copy of the pool.

```ts
const cloned = pool.clone();
```

#### `toUint32Array(): Uint32Array`

Returns a copy of the internal buffer as a Uint32Array. Use with `fromUint32Array` for serialization/deserialization.

```ts
const pool = new BitPool(64);
pool.acquire(); // 0
pool.acquire(); // 1
const serialized = pool.toUint32Array();

// Later...
const restored = BitPool.fromUint32Array(64, serialized);
```

### Zero-Allocation Methods

These methods avoid allocations in hot paths by using callbacks or preallocated buffers.

#### `forEachAvailable(callback: (index: number) => void, startIndex?: number, endIndex?: number): this`

Zero-allocation iteration over available indices via callback.

```ts
pool.forEachAvailable((index) => {
  console.log(`Index ${index} is available`);
});

// With range
pool.forEachAvailable((index) => {
  console.log(`Index ${index} is available`);
}, 100, 200);
```

#### `forEachOccupied(callback: (index: number) => void, startIndex?: number, endIndex?: number): this`

Zero-allocation iteration over occupied indices via callback.

```ts
pool.forEachOccupied((index) => {
  console.log(`Index ${index} is occupied`);
});
```

#### `forEachChunk(callback: (chunk: number, chunkIndex: number) => void): this`

Zero-allocation iteration over raw uint32 chunk values.

```ts
pool.forEachChunk((chunk, i) => {
  console.log(`Chunk ${i}: ${chunk.toString(2)}`);
});
```

#### `availableIndicesInto(out: Uint32Array, startIndex?: number, endIndex?: number): number`

Copy available indices into a preallocated buffer. Returns number of indices written.

```ts
const buffer = new Uint32Array(pool.availableCount);
const count = pool.availableIndicesInto(buffer);
```

#### `occupiedIndicesInto(out: Uint32Array, startIndex?: number, endIndex?: number): number`

Copy occupied indices into a preallocated buffer. Returns number of indices written.

```ts
const buffer = new Uint32Array(pool.occupiedCount);
const count = pool.occupiedIndicesInto(buffer);
```

### Set Operations

Binary set operations for combining BitPools. All require pools of equal size.

#### `intersect(other: BitPool): BitPool`

Returns a new BitPool containing only indices occupied in **both** pools (AND operation).

```ts
const a = new BitPool(32);
a.acquireN(4); // occupies 0, 1, 2, 3

const b = new BitPool(32);
b.acquireN(2); // occupies 0, 1

const intersection = a.intersect(b); // occupies 0, 1
```

#### `union(other: BitPool): BitPool`

Returns a new BitPool containing indices occupied in **either** pool (OR operation).

```ts
const a = new BitPool(32);
a.acquireN(2); // occupies 0, 1

const b = new BitPool(32);
b.acquire(); b.acquire(); b.acquire(); b.acquire();
b.release(0); b.release(1); // occupies 2, 3

const combined = a.union(b); // occupies 0, 1, 2, 3
```

#### `difference(other: BitPool): BitPool`

Returns a new BitPool containing indices occupied in this pool but **not** in the other (AND NOT operation).

```ts
const a = new BitPool(32);
a.acquireN(4); // occupies 0, 1, 2, 3

const b = new BitPool(32);
b.acquireN(2); // occupies 0, 1

const diff = a.difference(b); // occupies 2, 3 (in a but not in b)
```

#### `symmetricDifference(other: BitPool): BitPool`

Returns a new BitPool containing indices occupied in **exactly one** of the pools (XOR operation).

```ts
const a = new BitPool(32);
a.acquireN(3); // occupies 0, 1, 2

const b = new BitPool(32);
b.acquire(); b.acquire(); b.acquire(); b.acquire();
b.release(0); // occupies 1, 2, 3

const symDiff = a.symmetricDifference(b); // occupies 0, 3 (in one but not both)
```

### Iterators

#### `availableIndices(startIndex?: number, endIndex?: number): IterableIterator<number>`

Iterator that yields all available indices in the specified range.

```ts
for (const index of pool.availableIndices()) {
  console.log(`Index ${index} is available`);
}

// Iterate over a specific range
for (const index of pool.availableIndices(100, 200)) {
  console.log(`Index ${index} is available`);
}
```

#### `occupiedIndices(startIndex?: number, endIndex?: number): IterableIterator<number>`

Iterator that yields all occupied indices in the specified range.

```ts
for (const index of pool.occupiedIndices()) {
  console.log(`Index ${index} is occupied`);
}

// Iterate over a specific range
for (const index of pool.occupiedIndices(100, 200)) {
  console.log(`Index ${index} is occupied`);
}
```

#### `[Symbol.iterator](): IterableIterator<number>`

Iterator that yields the underlying `Uint32Array` values.

```ts
for (const chunk of pool) {
  console.log(`Chunk value: ${chunk}`);
}
```

## Use Cases

### Port Management

```ts
const TOTAL_PORTS = 65_536;
const RESERVED_UNTIL = 49_152;

// Create availability mask for ephemeral ports
function buildPortMask(capacity: number, reservedUntil: number): Uint32Array {
  const chunkCount = Math.ceil(capacity / 32);
  const mask = new Uint32Array(chunkCount);
  
  for (let i = reservedUntil; i < capacity; i++) {
    const chunkIndex = i >>> 5;
    const bitPosition = i & 31;
    mask[chunkIndex] |= (1 << bitPosition);
  }
  return mask;
}

const portMask = buildPortMask(TOTAL_PORTS, RESERVED_UNTIL);
const portPool = BitPool.fromUint32Array(TOTAL_PORTS, portMask);

const port = portPool.acquire(); // Get an ephemeral port
portPool.release(port); // Release it back
```

### Entity ID Management

```ts
const entityPool = new BitPool(10_000);

// Acquire IDs for new entities
const playerId = entityPool.acquire();
const enemyId = entityPool.acquire();

// Release IDs when entities are destroyed
entityPool.release(playerId);
entityPool.release(enemyId);
```

### Connection Pool

```ts
const connectionPool = new BitPool(100);

function getConnection(): number {
  const connId = connectionPool.acquire();
  if (connId === -1) {
    throw new Error("Connection pool exhausted");
  }
  return connId;
}

function releaseConnection(connId: number): void {
  connectionPool.release(connId);
}
```

### Serialization / Persistence

```ts
const pool = new BitPool(1000);

// Use the pool...
pool.acquireN(50);

// Save state
const state = pool.toUint32Array();
localStorage.setItem("poolState", JSON.stringify(Array.from(state)));

// Restore state
const saved = JSON.parse(localStorage.getItem("poolState")!);
const restored = BitPool.fromUint32Array(1000, new Uint32Array(saved));
```

## Performance

BitPool is designed for high-performance scenarios with minimal GC pressure:

- Backed by `Uint32Array` for efficient memory usage
- Optimized bitwise operations for fast lookups
- **Zero-allocation methods**: `forEachAvailable`, `forEachOccupied`, `forEachChunk`, `availableIndicesInto`, `occupiedIndicesInto`, `acquireNInto`
- **Allocating methods**: Generator iterators (`availableIndices`, `occupiedIndices`, `Symbol.iterator`) and `acquireN` allocate objects
- LIFO release behavior provides cache-friendly reuse patterns
- Efficient search algorithms for finding available slots

Run `deno task example` to see a performance demonstration with ephemeral port allocation.

## Contributing

Contributions are welcome! The aim of the project is performance - both in terms of speed and GC allocation pressure.

Please run `deno test` and `deno task prep` before committing.

## Documentation

See [jsr.io/@phughesmcr/bitpool](https://jsr.io/@phughesmcr/bitpool) for complete API documentation.

## License

BitPool is released under the MIT license. See `LICENSE` for further details.

&copy; 2025 The BitPool Authors. All rights reserved.

See `AUTHORS.md` for author details.
