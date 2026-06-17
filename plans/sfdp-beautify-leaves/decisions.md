# Architecture Decisions

## AD-1: faithful port of beautify_leaves

**Context:** `beautify_leaves` (`spring_electrical.c:195`) fans each node's
degree-1 leaves around it at their average distance.

**Decision:** Port exactly — keep `pad = 0.1`, the `[pad, 2π−pad]` fan,
`step = (ang2−ang1)/count` (0 when count==1), polar `set_leaves` placement,
the `checked` set (process each parent once), and gather order (`ja[p]`
adjacency order). No simplification or reordering.

**Consequences:** Matches the C trajectory. The algorithm is small; extract
`setLeaves` and `gatherLeaves` helpers to keep CCN ≤10 / fns ≤30 lines.

## AD-2: FMA at the set_leaves coordinate sites

**Context:** Disassembly of `set_leaves` in `libgvplugin_neato_layout` shows
`fmadd` for both `cos(ang)*dist + x[i]` and `sin(ang)*dist + y[i]`
(via `___sincos_stret`). The project's FMA lesson: any iterative
double-precision engine ported from this binary must fuse the same sites.

**Decision:** `setLeaves` uses `fma(Math.cos(ang), dist, x[dim*i])` and
`fma(Math.sin(ang), dist, x[dim*i+1])` (the existing `src/common/fma.ts`).

**Consequences:** Bit-faithful contraction. `cos`/`sin` still differ from
Apple `___sincos_stret` by ~1 ULP (V8 vs Apple libm), so the result matches
the oracle to ~6 digits, consistent with the existing sfdp test precision.

## AD-3: no-diagonal invariant assumed (guaranteed upstream)

**Context:** C `assert(!SparseMatrix_has_diagonal(A))`. The diagonal is
removed upstream (`SparseMatrix_remove_diagonal`, C `:1090`); `smSymmetrize`
does NOT remove it but the input matrix already has none.

**Decision:** `beautifyLeaves` assumes no diagonal (so `node_degree =
ia[i+1]−ia[i]` counts only neighbors). Do not re-add a removal step. If a
diagonal is ever present, that is an upstream-matrix bug, not a beautify
concern — STOP and surface it rather than masking.

## AD-4: test strategy — oracle pin end-to-end + deterministic unit

**Context:** sfdp PRNG is matched (deterministic), but bare star/tiny sparse
graphs diverge chaotically (~1e-3) from the oracle — a pre-existing FP
sensitivity, NOT a beautify bug. A well-connected graph with a few leaves is
oracle-stable to 6 digits.

**Decision:** Correctness gate = e2e oracle pin to 6 digits on the
ring+2-leaves graph (README ground truth). Plus a deterministic unit test
(known star input → exact radial fan). Flip the existing guard test.

**Consequences:** Real end-to-end verification (base + per-level beautify +
FMA), not just a unit test. The bare-star chaotic divergence is documented
as out of scope.

## AD-5: rollback / compatibility

Reversible — revert the merge. No data/API/schema change. Additive: a
graph that threw now renders. sfdp goldens (beautify off) unaffected.
