# T16 — lib/sparse Port (SparseMatrix + QuadTree)

## Context

The project is a faithful TypeScript 5.x port of Graphviz `lib/`, targeting
SVG output. TypeScript strict mode, Vitest, esbuild, EPL-2.0, no Node.js in
core.

`lib/sparse` implements the sparse matrix data structures and graph algorithms
used by `lib/sfdpgen` for the SFDP force-directed layout engine. Because
sfdpgen is in the SVG rendering path (sfdp layout → SVG), the full lib/sparse
is in scope.

The two primary components are:

1. **`SparseMatrix`** — a dual-format (CSR / COO) sparse matrix with
   arithmetic operations, symmetrization, BFS, WCC, and distance matrix
   computation. The canonical reference is `lib/sparse/SparseMatrix.h`.

2. **`QuadTree`** — a recursive quadtree (generalized to arbitrary dimension)
   for Barnes-Hut O(n log n) approximation of repulsive forces in the SFDP
   spring-electrical model. The canonical reference is `lib/sparse/QuadTree.h`.

The `general.h` vector math utilities (`dotProduct`, `saxpy`, `distance`,
`distanceCropped`, `pointDistance`, `drand`) must also be ported as they are
called directly by `lib/sfdpgen`.

The `clustering.h`, `mq.h`, `DotIO.h`, `color_palette.h`, and `colorutil.h`
files are in scope as they feed into the sfdp layout pipeline; include them
in `src/sparse/index.ts` exports.

## TEST DISCIPLINE — Non-Negotiable

**Tests are written before implementation. Expected values come from C source
only. Tests are never changed to match code output.**

Mandatory workflow:
1. Read `SparseMatrix.c`, `QuadTree.c`, and `general.c` fully before
   writing any TypeScript.
2. Derive every expected value (matrix entries, vector multiply outputs,
   QuadTree neighbor results) directly from the C source. Where exact
   output is needed, trace through the C algorithm to obtain ground truth.
3. Write `sparse.test.ts` with those C-derived expected values as
   assertions.
4. Then write the implementation files to satisfy the tests.
5. If a test fails: re-read the C, fix the TypeScript. Never touch the
   assertion.

**If a failing test cannot be fixed without changing its assertion, STOP.**
Log to `decision-journal.md` and wait for human input. This is Stop
Condition 8 in the mission README (AD-13).

## Task

Port `lib/sparse` to TypeScript with the following fidelity requirements:

### SparseMatrix

Two formats:
- `FORMAT_CSR`: `ia` is a row pointer array of length `m+1`. `ia[0] = 0`,
  `ia[m] = nz`. Columns for row `i` are at `ja[ia[i]..ia[i+1]-1]`.
- `FORMAT_COORD` (COO): `ia` and `ja` are parallel row/col arrays of length
  `nzmax`. Entry type is `REAL` (Float64Array), `INTEGER` (Int32Array), or
  `PATTERN` (no values).

**Use `Float64Array` for all numeric (REAL) value arrays and `Int32Array` for
`ia` and `ja` index arrays.** Do not use plain JavaScript `number[]` arrays
for matrix data. This matches the typescript-port.md directive for sfdp:
"Use `Float64Array` for vectors."

COO→CSR conversion (`fromCoordinateFormat`) sums repeated `(row,col)` entries
by default. The `notCompacted` variant preserves them.

Port all public functions from `SparseMatrix.h` as methods on a `SparseMatrix`
class or as standalone functions. The key operations called by `lib/sfdpgen`
(see `lib/sparse/lib/sparse.md` — "Which functions lib/sfdpgen calls") must
be present with identical signatures translated to TypeScript.

**Non-obvious behavioral notes to preserve exactly:**

- `SparseMatrix_sort` destroys its input (internally calls delete then
  reconstructs). In TypeScript: the function should not be called on a matrix
  where the caller still holds a reference expecting the original data.
  Document this in JSDoc.
- `SparseMatrix_multiply_vector`: `v == null` is treated as all-ones vector.
- Symmetry flags `isSymmetric` and `isPatternSymmetric` are cached. Operations
  that produce symmetric results set these flags on the result.
  `removeUpper` explicitly clears them.
- Distance matrix is fully dense: `ia[i] = i*n`, all n×n entries stored.
  Entry -1 = disconnected. The C code asserts all nodes are connected;
  TypeScript should throw if a disconnected component is found.
- COO growth: `addEntry` grows `nzmax` by 10 when full. Preserve this
  growth constant.
- Mask-based O(nnz) operations: multiply, add, sumRepeats, symmetry check
  all use a dense integer `mask[n]` array initialized to -1 and stamped with
  the current row index. Implement this using a plain `Int32Array` of length n.

### QuadTree

Port `QuadTree.h` / `QuadTree.c` exactly. Key behavioral requirements:

- Width slack: `QuadTree.newFromPointList` multiplies the bounding-box width
  by **0.52** (not 0.5) to accommodate floating-point boundary coordinates.
- Quadrant encoding: bit-decompose the quadrant index per dimension to compute
  child center. For dim=2, quadrant 2 means x > center, y < center.
- Force accumulation two-phase design: `getRepulsiveForce` calls `_interact`
  (cell-cell) then `_accumulate` (push to nodes). Do not merge these phases.
- Barnes-Hut criterion: cell treated as supernode when
  `width_cell1 + width_cell2 < bh * dist`.
- Power-law: `p == -1` selects `f = KP/dist²`; other p values use
  `pow(dist, 1-p)`.
- `getNearest`: two passes (tentative greedy child, then exact full
  traversal).
- `delete`: recursively frees everything including per-cell `data` buffers
  allocated by `getRepulsiveForce`. The `data` pointers on leaf `nodeData`
  nodes point into the caller-supplied `force` array and must NOT be freed.

### general.h utilities

```typescript
export function drand(): number;            // Math.random() — not seeded
export function distance(x: Float64Array, dim: number, i: number, j: number): number;
export function distanceCropped(x: Float64Array, dim: number, i: number, j: number): number;
export function pointDistance(p1: Float64Array, p2: Float64Array, dim: number): number;
export function vectorSubtractTo(n: number, x: Float64Array, y: Float64Array): Float64Array;
export function vectorProduct(n: number, x: Float64Array, y: Float64Array): number;
export function vectorSaxpy(n: number, x: Float64Array, y: Float64Array, beta: number): Float64Array;
export function vectorSaxpy2(n: number, x: Float64Array, y: Float64Array, beta: number): Float64Array;
```

Constants: `MACHINEACC = 1e-16`, `SQRT_MACHINEACC = 1e-8`, `MINDIST = 1e-15`,
`SYMMETRY_EPSILON = 0.0000001`.

## Write-Set

- `src/sparse/SparseMatrix.ts`
- `src/sparse/QuadTree.ts`
- `src/sparse/index.ts`
- `src/sparse/sparse.test.ts`

## Read-Set

- `~/git/graphviz/lib/sparse/SparseMatrix.h`
- `~/git/graphviz/lib/sparse/SparseMatrix.c` — full implementation
- `~/git/graphviz/lib/sparse/QuadTree.h`
- `~/git/graphviz/lib/sparse/QuadTree.c` — full implementation
- `~/git/graphviz/lib/sparse/general.h`
- `~/git/graphviz/lib/sparse/general.c`
- `~/git/graphviz/docs/architecture/lib/sparse.md` — behavioral notes and
  the list of functions called by lib/sfdpgen

## Architecture Decisions

- No architecture decisions specific to this task beyond the general project
  constraints. `Float64Array` for numeric vectors is per the typescript-port.md
  directive for sfdp.

## Interface Contracts

The canonical contracts are the C function signatures in `SparseMatrix.h` and
`QuadTree.h` translated to TypeScript. Key types:

```typescript
export const FORMAT_CSR = 0;
export const FORMAT_COORD = 1;
export const MATRIX_TYPE_REAL = 1 << 0;
export const MATRIX_TYPE_INTEGER = 1 << 2;
export const MATRIX_TYPE_PATTERN = 1 << 3;
export const UNMASKED = -10;
export const MASKED = 1;
export const SYMMETRY_EPSILON = 0.0000001;

export class SparseMatrix {
  m: number;        // rows
  n: number;        // columns
  nz: number;       // used non-zero count
  nzmax: number;    // allocated capacity
  type: number;     // MATRIX_TYPE_*
  ia: Int32Array;   // row pointers (CSR) or row indices (COO)
  ja: Int32Array;   // column indices
  a: Float64Array | Int32Array | null;  // values (null for PATTERN)
  format: number;   // FORMAT_CSR or FORMAT_COORD
  isPatternSymmetric: boolean;
  isSymmetric: boolean;
  isUndirected: boolean;

  static new(m: number, n: number, nz: number, type: number, format: number): SparseMatrix;
  static fromCoordinateArrays(nz: number, m: number, n: number, irn: Int32Array, jcn: Int32Array, val: Float64Array | Int32Array | null, type: number): SparseMatrix;
  multiplyVector(v: Float64Array | null, res?: Float64Array): Float64Array;
  multiplyDense(v: Float64Array, res: Float64Array, dim: number): void;
  // ... all other public methods from SparseMatrix.h
}
```

## Acceptance Criteria

1. CSR matrix-vector multiply produces the same result as an equivalent COO
   matrix: construct a 3×3 CSR and COO matrix with identical entries, call
   `multiplyVector` on both, compare outputs element-by-element.
2. QuadTree insert and query handles boundary nodes: construct a QuadTree
   with width W, insert a point at exactly `center + W` (on the boundary),
   call `getNearest`, verify it returns that point.
3. `Float64Array` is used for all REAL-type numeric value arrays; verified
   by `instanceof Float64Array` assertions in the test.
4. `fromCoordinateFormat` sums repeated `(row,col)` entries: insert `(0,0)=1`
   and `(0,0)=2` into a COO matrix, convert to CSR, verify entry is 3.

## Observability

N/A — pure algorithm module.

## Rollback

Reversible. No module depends on `src/sparse/` until the sfdp layout engine
(Batch 10).

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/sparse/sparse.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- 90% line coverage, 90% branch coverage (vitest `--coverage`)
