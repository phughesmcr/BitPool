import { BitPool } from "../src/BitPool.ts";

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
