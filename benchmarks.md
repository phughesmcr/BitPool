# Benchmarks

// "jsr:@phughesmcr/booleanarray@^0.8.0"

| Group                | Operation                 | Time (avg) | Iterations/s | Min      | Max      | p75      | p99      |
| -------------------- | ------------------------- | ---------- | ------------ | -------- | -------- | -------- | -------- |
| **Constructor**      |                           |            |              |          |          |          |          |
|                      | Small pool (32 bits)      | 343.5 ns   | 2,911,000    | 322.8 ns | 520.4 ns | 350.9 ns | 386.7 ns |
|                      | Medium pool (1024 bits)   | 371.5 ns   | 2,692,000    | 350.9 ns | 457.7 ns | 376.9 ns | 438.8 ns |
|                      | Large pool (100000 bits)  | 2.6 µs     | 390,900      | 1.6 µs   | 4.0 µs   | 2.8 µs   | 4.0 µs   |
| **Acquire**          |                           |            |              |          |          |          |          |
|                      | Best case (first bit)     | 377.0 ns   | 2,652,000    | 356.8 ns | 531.8 ns | 380.0 ns | 458.0 ns |
|                      | Worst case (last bit)     | 6.3 µs     | 157,700      | 6.3 µs   | 6.6 µs   | 6.4 µs   | 6.6 µs   |
|                      | Random pattern (50% full) | 3.4 µs     | 295,800      | 3.3 µs   | 3.5 µs   | 3.4 µs   | 3.5 µs   |
| **Release**          |                           |            |              |          |          |          |          |
|                      | Single bit                | 373.3 ns   | 2,679,000    | 354.1 ns | 615.9 ns | 377.4 ns | 483.0 ns |
|                      | Multiple bits             | 507.2 ns   | 1,971,000    | 476.6 ns | 957.1 ns | 496.1 ns | 891.9 ns |
| **IsOccupied**       |                           |            |              |          |          |          |          |
|                      | First bit                 | 358.6 ns   | 2,788,000    | 341.5 ns | 412.1 ns | 366.1 ns | 408.9 ns |
|                      | Last bit                  | 358.6 ns   | 2,789,000    | 344.0 ns | 410.5 ns | 364.0 ns | 410.3 ns |
|                      | Mixed state               | 396.0 ns   | 2,525,000    | 381.6 ns | 463.7 ns | 400.3 ns | 462.7 ns |
| **Large Pools**      |                           |            |              |          |          |          |          |
|                      | Constructor (1M bits)     | 11.2 µs    | 89,140       | 2.9 µs   | 3.3 ms   | 6.6 µs   | 57.2 µs  |
|                      | Acquire first bit         | 9.9 µs     | 101,200      | 3.2 µs   | 4.9 ms   | 6.2 µs   | 58.4 µs  |
|                      | Acquire after operations  | 16.3 µs    | 61,270       | 8.1 µs   | 15.1 ms  | 11.7 µs  | 61.6 µs  |
| **Clear**            |                           |            |              |          |          |          |          |
|                      | Small pool                | 396.3 ns   | 2,523,000    | 386.2 ns | 440.1 ns | 398.6 ns | 436.0 ns |
|                      | Medium pool               | 419.2 ns   | 2,386,000    | 405.3 ns | 475.4 ns | 424.3 ns | 472.1 ns |
|                      | Large pool                | 3.0 µs     | 337,700      | 2.7 µs   | 5.0 µs   | 2.9 µs   | 5.0 µs   |
|                      | After modifications       | 972.8 ns   | 1,028,000    | 948.8 ns | 1.1 µs   | 981.6 ns | 1.1 µs   |
| **Hierarchy Stress** |                           |            |              |          |          |          |          |
|                      | Deep hierarchy pool       | 706.5 ns   | 1,415,000    | 567.5 ns | 2.1 µs   | 727.4 ns | 2.1 µs   |
|                      | Acquire across boundaries | 6.3 µs     | 157,500      | 6.2 µs   | 6.9 µs   | 6.4 µs   | 6.9 µs   |
|                      | Fragmented state          | 17.8 µs    | 56,040       | 15.9 µs  | 160.8 µs | 17.8 µs  | 25.7 µs  |
| **Access Patterns**  |                           |            |              |          |          |          |          |
|                      | Sequential access         | 906.9 ns   | 1,103,000    | 884.4 ns | 1.0 µs   | 913.5 ns | 1.0 µs   |
|                      | Random access             | 1.2 µs     | 826,300      | 1.2 µs   | 1.6 µs   | 1.2 µs   | 1.6 µs   |
|                      | Scattered access          | 6.0 µs     | 166,000      | 6.0 µs   | 6.1 µs   | 6.0 µs   | 6.1 µs   |
