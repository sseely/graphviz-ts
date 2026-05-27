# T41 — Stress Majorization

## Context

Stress majorization is the core numerical solver for neato's `MODE_MAJOR`
and `MODE_KK` modes. The C implementation lives in `stress.c` (the main
engine, `stress_majorization_kD_mkernel`) and `conjgrad.c` (the conjugate
gradient inner solver). `constrained_majorization.c` adds hierarchy
constraints for `MODE_HIER` (DiG-CoLa) but that path is conditionally
compiled under `#ifdef DIGCOLA` — the TypeScript port implements the full
engine including DiG-CoLa.

**CRITICAL — Kahan summation for Laplacian diagonal:**

The C code uses `DegType = long double` to accumulate the Laplacian
diagonal entries. The comment in `stress.h` is explicit: this compensates
for float cancellation when summing many off-diagonal weights. TypeScript has
no `long double`. The TypeScript port MUST use Kahan summation for all
Laplacian diagonal accumulation. This is a stop condition: if the test
reveals that the Kahan workaround was omitted, execution must halt.

The specific location is the diagonal computation in `stress_majorization_kD_mkernel`:
for each node i, the diagonal entry of `lap2` (weight Laplacian) is computed
as `lap2[diag(i)] = -sum(lap2[off-diagonal entries in row i])`. This sum uses
`long double` in C. Use Kahan in TypeScript.

The same applies to `lap1` (position-weighted Laplacian) built inside the
main loop.

**Convergence constants (must match C exactly):**

From `stress.h`:
```c
#define tolerance_cg    1e-3   // CG inner solver tolerance
#define DFLT_ITERATIONS 200    // default max outer iterations
#define DFLT_TOLERANCE  1e-4   // Epsilon: outer stress convergence
```

These are not parameters — they are constants. Do not make them
configurable. Changing them changes convergence behavior.

**Conjugate gradient variants:**

Three variants in `conjgrad.c`. The one used in the main stress loop is
`conjugate_gradient_mkernel` — it operates on a packed symmetric float
matrix (upper triangular, row-major), re-orthogonalizes every iteration to
fight null-space drift, and uses `float` arithmetic internally. The other
two (`conjugate_gradient` for sparse vtx_data, `conjugate_gradient_f` for
dense float matrix) are used by DiG-CoLa and the hierarchical path.

**Null-space orthogonalization:**

The graph Laplacian is singular (null space = span of all-ones vector).
Before solving, both `b` and `x` are orthogonalized against the constant
vector using `orthog1` (subtract mean). Without this, CG fails to converge.
This orthogonalization step is not optional.

**Overflow guard for coincident nodes:**

In `lap1` construction, if `dist_ij >= FLT_MAX` or `dist_ij < 0`, the
entry is clamped to `0`. This handles coincident nodes (zero Euclidean
distance). The TypeScript port must implement this clamp.

**Dense packed storage:**

`lap2` and `lap1` are packed upper-triangular `Float32Array` of length
`n*(n+1)/2`. Off-diagonal entry `(i,j)` for `j > i` is at index
`i*(2*n-i-1)/2 + j`. Diagonal entry `(i,i)` is at the start of row i:
index `i*(2*n-i-1)/2 + i`.

## Task

Port `lib/neatogen/stress.c`, `lib/neatogen/conjgrad.c`, and the non-DIGCOLA
parts of `lib/neatogen/constrained_majorization.c`.

1. **`conjgrad.ts`**: Three CG variant functions:
   - `conjugateGradient`: sparse vtx_data CG (used by DiG-CoLa Y-axis init)
   - `conjugateGradientF`: dense float matrix CG (used by smart init path)
   - `conjugateGradientMkernel`: packed symmetric float CG with per-iteration
     re-orthogonalization (used in main stress loop). This is the critical path.

2. **`stress.ts`**: Full stress majorization engine:
   - `stressMajorizationKD`: main entry point, matching
     `stress_majorization_kD_mkernel`. Returns iteration count or -1 on
     CG failure.
   - `computeStress`: current stress value for convergence monitoring.
   - Distance model dispatch: `computeApspPacked` (BFS, default),
     `computeWeightedApspPacked` (Dijkstra, MODEL_MDS), circuit model
     (MODEL_CIRCUIT), subset model (MODEL_SUBSET). All called from T40.

## Write-Set

- `src/layout/neato/stress.ts`
- `src/layout/neato/conjgrad.ts`
- `src/layout/neato/stress.test.ts`

## Read-Set

- `~/git/graphviz/lib/neatogen/constrained_majorization.c` — full file:
  Laplacian construction, main loop, convergence, DiG-CoLa hierarchy path
- `~/git/graphviz/lib/neatogen/conjgrad.c` — all three CG variants,
  null-space orthogonalization, re-orthogonalization in mkernel variant
- `~/git/graphviz/docs/architecture/lib/neatogen.md` — `stress.c`,
  `conjgrad.c`, `constrained_majorization.c` sections (full algorithm
  descriptions with pseudocode)

## Architecture Decisions

- **AD-1**: `DegType = number` with Kahan summation for diagonal
  accumulation. TypeScript has no `long double`. This is the mandated
  workaround.
- **AD-3**: `lap2` and `lap1` are owned `Float32Array` values. The C
  equivalents are heap-allocated `float*`.

## Interface Contracts

```typescript
// src/layout/neato/conjgrad.ts

/** Packed symmetric float CG (the main stress loop solver). */
export function conjugateGradientMkernel(
  A: Float32Array,        // packed upper-triangular float matrix
  x: Float32Array,        // solution vector (modified in place)
  b: Float32Array,        // right-hand side
  n: number,
  tol: number,            // caller passes tolerance_cg = 1e-3
  maxIterations: number,
): number;  // 0 = success, 1 = zero-length vector

/** Sparse vtx_data CG (used by DiG-CoLa Y-axis). */
export function conjugateGradient(
  A: import('./dijkstra').VtxData[],
  x: Float64Array,
  b: Float64Array,
  n: number,
  tol: number,
  maxIterations: number,
): number;

// src/layout/neato/stress.ts

export const TOLERANCE_CG = 1e-3;
export const DFLT_ITERATIONS = 200;
export const DFLT_TOLERANCE = 1e-4;

export function stressMajorizationKD(
  graph: import('./dijkstra').VtxData[],
  n: number,
  dCoords: Float64Array[],  // [dim][n] output positions
  nodes: import('../../model/Node').Node[],
  dim: number,
  opts: number,
  model: number,
  maxi: number,
): number;  // iteration count or -1 on CG failure
```

## Acceptance Criteria

1. Kahan summation is used for all Laplacian diagonal accumulation in
   `lap1` and `lap2` construction (not plain addition).

2. `TOLERANCE_CG` is the constant `1e-3` — not a parameter, not configurable.

3. `DFLT_ITERATIONS` is the constant `200`.

4. Stress decreases monotonically across outer iterations on a connected
   test graph (4 nodes, 4 edges with distinct weights), verified by calling
   `computeStress` after each outer iteration.

## Observability

N/A — pure numerical algorithms; no I/O.

## Rollback

Reversible. Writes only new files under `src/layout/neato/`. Revert by
removing the files.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/layout/neato/stress.test.ts` exits 0
- One commit: `feat(neato): port stress majorization and conjugate gradient`
- Tests cover: `TOLERANCE_CG === 1e-3`; `DFLT_ITERATIONS === 200`;
  monotonic stress decrease on a 4-node test graph; Kahan summation
  produces different result than plain summation on a crafted example
  that exposes float cancellation.
