# neato Layout Engine — Porting Gaps

## NEA-1: `MODEL_CIRCUIT` (circuitModel)

**Status:** Falls back to BFS/shortpath with a `console.warn`.

**C reference:** `lib/neatogen/stress.c:circuitModel` (line 169),
called at `lib/neatogen/neatoinit.c:852` when `model == MODEL_CIRCUIT`.
In SGD mode: `lib/neatogen/sgd.c:sgd` (line 142, `resolveModel` block).

**TS location:** `src/layout/neato/stress.ts:279-288` (computeDij fallback),
`src/layout/neato/sgd.ts:391-404` (resolveModel fallback).

**Reachability:** ATTR — requires `model=circuit` on the graph. Neato's
default model is `shortpath`. Circuit model is used for graphs where
resistance-distance (electrical) metrics are desired rather than
shortest-path distances.

**Downstream visual impact:** HIGH for any graph using `model=circuit`:
the circuit distance matrix is entirely different from BFS/Dijkstra;
the resulting layout will have incorrect inter-node distances. The
current fallback silently substitutes the wrong distance model.

**Algorithm:** `circuitModel` computes the resistance distance matrix
via Laplacian inversion. For n nodes: build graph Laplacian L, compute
pseudo-inverse L+ (via eigendecomposition or Cholesky), then
`d_ij = L+_ii + L+_jj - 2*L+_ij`. The pseudo-inverse requires a
dense linear algebra routine not currently present in the port.

**Dependencies:** Requires a dense matrix pseudo-inverse (not currently
in `src/layout/neato/matrix-ops.ts`). Possibly reuse the conjugate-gradient
infrastructure from `stress-kernel.ts`. This is the main new dependency.

**Estimated size:** ~200 LOC new code (Laplacian + pseudo-inverse) +
~50 LOC wiring changes in `stress.ts` and `sgd.ts`.

---

## NEA-2: `MODEL_MDS` in SGD

**Status:** Falls back to shortpath with a `console.warn`.

**C reference:** `lib/neatogen/sgd.c:sgd` (line 142), MDS model path.
In stress (non-SGD) mode: `lib/neatogen/stress.c:computeDij` uses
`computeWeightedApspPacked` for MDS/SUBSET (already ported).

**TS location:** `src/layout/neato/sgd.ts:394-404` (resolveModel fallback).

**Reachability:** ATTR — requires `model=mds` combined with `mode=sgd`.
Default neato uses stress majorization. MDS+SGD is a niche combination.

**Downstream visual impact:** MEDIUM — for MDS+SGD graphs the port uses
shortpath distances; the visual result differs from C but is not broken.

**Dependencies:** The MDS distance computation (weighted APSP) is already
ported in `stress.ts`. Only the SGD model-resolution path needs wiring.

**Estimated size:** ~150 LOC.

**Notes:** Best bundled with NEA-1 into a single `mission-neato-models`
since both gaps are in the same `resolveModel`/`computeDij` call chain.

---

## NEA-3: `smart_init` / sparse subspace initialization

**Status:** Not ported — `src/layout/neato/stress-kernel.ts:11` notes
that `smart_init` is skipped; `checkStart` always yields `INIT_RANDOM`.

**C reference:** `lib/neatogen/neatoinit.c:checkStart` (line 980),
`lib/neatogen/neatoinit.c:1092-1096` (opts `opt_smart_init`).
`smart_init` performs sparse eigenvector initialization as a warm start
for stress majorization.

**TS location:** `src/layout/neato/stress-kernel.ts:11` (comment),
`src/layout/neato/init.ts:332-343` (checkStart stub).

**Reachability:** ATTR — `smart_init` activates when `start=N` (integer
seed) is set AND the graph is large enough for the sparse approximation
to pay off (controlled by internal thresholds in C). In practice it fires
for `start=<integer>` with large graphs.

**Downstream visual impact:** LOW — the layout still converges to a valid
embedding; `smart_init` only provides a better starting position that
reduces the number of majorization iterations needed. The final quality
is comparable.

**Dependencies:** Sparse eigenvector computation (power method or Lanczos
on the graph Laplacian). The sparse matrix infrastructure is already in
`src/layout/sfdp/sparse-matrix.ts`. This is a significant algorithm port.

**Estimated size:** ~300 LOC.

---

## NEA-4: `start=regular` / `start=self`

**Status:** Not ported — `src/layout/neato/init.ts:332-343` notes these
init modes are silently skipped; random init is used.

**C reference:** `lib/neatogen/neatoinit.c:checkStart` (line 980),
lines 929 (`INIT_SELF`) and 932 (`INIT_REGULAR`), and
`lib/neatogen/neatoinit.c:initRegular` (line 973).

**TS location:** `src/layout/neato/init.ts:330-343`.

**Reachability:** ATTR — requires `start=regular` or `start=self` on the
graph. Rare; used when the user wants deterministic circular initialization
(`regular`) or self-loop initialization for hierarchical graphs (`self`).

**Downstream visual impact:** LOW — the layout converges to a valid
embedding regardless; only the starting positions differ.

**Dependencies:** `initRegular` places nodes on a circle, which is simple
geometry. `INIT_SELF` uses the hierarchy to seed. Neither requires new
algorithmic infrastructure.

**Estimated size:** ~100 LOC.

---

## NEA-5: xlabels on edges (neato)

**Status:** Not ported — `src/layout/neato/splines.ts:414` notes
"xlabels are not ported".

**C reference:** `lib/neatogen/neatoinit.c:343` (`ED_xlabel(e)` path),
`lib/neatogen/neatoinit.c:535` (`ND_xlabel` path).
The positioning calls appear in `lib/common/splines.c` after edge routing.

**TS location:** `src/layout/neato/splines.ts:414-415`.

**Reachability:** ATTR — requires `xlabel=` attribute on an edge. External
labels are a legitimate and common DOT feature. They are suppressed in
the current neato output.

**Downstream visual impact:** MEDIUM — edges with `xlabel` will simply
have no label rendered. This is a visible missing feature for any DOT
file that uses external edge labels.

**Dependencies:** The `ED_xlabel` tracking and `set_label` positioning
logic. The neato `splineEdges` already routes edges; the xlabel placement
happens after routing using the bounding box. Relatively self-contained.

**Estimated size:** ~100 LOC in `neato/splines.ts` and `neato/init.ts`.

---

## NEA-6: `adjustNodes` VPSC overlap removal (full)

**Status:** No-op stub for neato, twopi, and circo.

**C reference:** `lib/neatogen/adjust.c:adjustNodes` (line 999),
`lib/neatogen/adjust.c:removeOverlapAs` (line 986).
These implement VPSC (Variable Placement with Separation Constraints)
and Prism overlap removal for neato, fdp, twopi, and circo.

**TS location:**
- neato: `src/layout/neato/overlap.ts` (partial port exists)
- twopi: `src/layout/twopi/init.ts:146-148` (no-op)
- circo: `src/layout/circo/circular.ts:147` (no-op)

**Reachability:** ATTR — controlled by the `overlap` attribute. Default
for neato is `prism` (overlap=prism) which IS the VPSC path. So for
any neato graph where nodes visually overlap, this matters. For twopi
and circo the radius formula spaces nodes adequately in most cases.

**Downstream visual impact:** MEDIUM for neato with dense graphs — nodes
may overlap when the stress embedding places them too close. For twopi
and circo, the impact is lower because the radial layout inherently
separates nodes.

**Dependencies:** VPSC requires the `src/lib/vpsc/` module (T11 in
the original mission). The VPSC solver was scaffolded but the C source
integration into `adjustNodes` was not completed. This is the largest
infrastructure gap after DOT-1.

**Estimated size:** ~400 LOC to complete the VPSC integration and wire
it for neato, twopi, circo. The prism OverlapSmoother adds another
~200 LOC (shared with SFDP-3 and FDP-3).
