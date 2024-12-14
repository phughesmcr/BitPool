# BitPool

A high-performance BitPool implementation backed by Uint32Array for efficient memory usage and fast bitwise operations.

<p align="left">
  <img src="https://badgen.net/badge/license/MIT/blue" alt="MIT License" />
  <img src="https://badgen.net/badge/icon/typescript?icon=typescript&label" alt="Written in Typescript">
  <img src="https://img.shields.io/badge/deno-^2.1.0-lightgrey?logo=deno" alt="Deno version" />
  <img src="https://img.shields.io/badge/bun-%5E1.1.0-lightgrey?logo=bun" alt="Bun version" />
  <img src="https://img.shields.io/badge/node-%5E22.0.0-lightgrey?logo=node.js" alt="Node version" />
</p>

See [jsr.io/@phughesmcr/bitpool](https://jsr.io/@phughesmcr/bitpool) for complete documentation.

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

## Usage

`deno task example` will run a complete example.

```ts
const pool = new BitPool(1000); // 0 - 999

const entity_1 = pool.acquire();
const entity_2 = pool.acquire();

console.log(pool.isOccupied(entity_1));
console.log(pool.isOccupied(entity_2));
console.log(pool.isOccupied(999));

pool.release(entity_1);
pool.release(entity_2);

console.log(pool.isOccupied(entity_1));
console.log(pool.isOccupied(entity_2));
console.log(pool.isOccupied(999));
```

## Contributing

Contributions are welcome. The aim of the project is performance - both in terms of speed and GC allocation pressure.

Please run `deno test` and `deno task prep` to run the tests before committing.

## License

BitPool is released under the MIT license. See `LICENSE` for further details.

&copy; 2024 The BitPool Authors. All rights reserved.

See `AUTHORS.md` for author details.
