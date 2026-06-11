# T2 — substrate: minstd rand + SparseMatrix subset

## Context
See gap-analysis.md. All sfdp randomness flows through ONE global
libc rand() stream (macOS = Park–Miller minstd); the SparseMatrix CSR
subset is the data structure under everything. No behavior switches
in this task — pure substrate with unit tests.

## Task
1. `src/common/crand.ts`: global mutable state; `csrand(seed)`,
   `crand()` (seed = seed·16807 % 2147483647, exact in doubles),
   `RAND_MAX_C = 2147483647`, `cdrand()` = crand()/RAND_MAX_C,
   `gvRandom(bound)` (discard-threshold rejection per util/random.c),
   `gvPermutation(bound)` (Fisher–Yates, i from bound−1 down,
   j = gvRandom(i+1), swap). Initial state = srand(1) semantics
   (verify what unseeded rand() returns in C: state 1).
   Unit test: srand(123) → 2067261, 384717275, 2017463455,
   888985702 (verified against /tmp/randtest on this machine).
2. `src/layout/sfdp/sparse-matrix.ts`: CSR + COORD formats, REAL +
   PATTERN types. Port EXACTLY (row entry order is load-bearing):
   from_coordinate_arrays (and the sum_repeated semantics it uses),
   from_coordinate_format, coordinate_form_add_entry, symmetrize,
   is_symmetric (pattern/value), get_real_adjacency_matrix_symmetrized,
   remove_diagonal, has_diagonal, transpose, multiply, multiply3,
   multiply_dense, divide_row_by_degree, copy,
   decompose_to_supervariables. Read each from
   /tmp/sfdp-spec/SparseMatrix.c — do NOT normalize/sort rows unless
   the C does.
   Unit tests: small matrices with known CSR layouts incl. the
   multiply mask-accumulator append order and symmetrize row order.

## Write-set
src/common/crand.ts (journal: common), src/layout/sfdp/sparse-matrix.ts
(+ tests).

## Quality bar
Gates per ../README.md; @see per symbol; suite unchanged (nothing
wired yet).

## Commit
`feat(sfdp): port minstd rand stream and SparseMatrix subset`
