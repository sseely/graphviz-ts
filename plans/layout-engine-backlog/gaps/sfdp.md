# sfdp Layout Engine — Porting Gaps

## SFDP-1: `beautify_leaves`

**Status: DONE (mission sfdp-beautify-leaves, 2026-06-17, merged).**
`beautifyLeaves` ported in `spring-electrical.ts` (radial leaf fan, fma at
set_leaves to match the C fmadd); the throw is replaced by the per-level
call. Oracle-pinned to sfdp 15.0.0 (6 digits) on a well-connected
ring+2-leaves graph; bare stars are not oracle-stable (chaotic FP symmetry,
documented). 1860 pass, zero golden churn.

**(historical) Status:** THROWS — `src/layout/sfdp/spring-electrical.ts:356` throws
`Error('sfdp beautify_leaves not ported ...')` when `ctrl.beautifyLeaves`
is true.

**C reference:** `lib/sfdpgen/spring_electrical.c:beautify_leaves` (line 195),
called at lines 378, 508, 669, and 811 (once per embedding level) when
`ctrl->beautify_leaves` is true.

**TS location:** `src/layout/sfdp/spring-electrical.ts:355-357`,
`src/layout/sfdp/init.ts:121` (flag set from `beautify` attr).

**Reachability:** ATTR — set by graph attribute `beautify=true`. Not a
default. Used to reposition degree-1 leaf nodes for aesthetic improvement
after the force-directed embedding.

**Downstream visual impact:** MEDIUM — without `beautify_leaves`, leaf
nodes remain at the positions determined by the force model (which tends
to cluster them). With `beautify=true`, a user explicitly requests the
repositioning; the current port throws instead of producing any output.

**Algorithm:** `beautify_leaves` moves each degree-1 node to the centroid
of its single neighbor's other neighbors (a simple averaging step). It
uses the sparse adjacency matrix `A` and the position array `x`. No new
data structures needed beyond what is already available.

**Dependencies:** None — all required data (`A`, `x`, `dim`) is already
in scope at the call site in `springElectricalEmbedding`.

**Estimated size:** ~150 LOC (the C function is ~35 lines; TS will be
~50 lines for the inner loop + ~100 LOC for tests).

---

## SFDP-2: `edge_labeling_scheme` (label_scheme > 0)

**Status:** Not ported — guarded with an explicit skip.

**C reference:** `lib/sfdpgen/spring_electrical.c:1094-1189`,
referenced at `lib/sfdpgen/spring_electrical.c:1094` and `1189` via
`ctrl->edge_labeling_scheme`. Attr name is `label_scheme` (int 1–4).
Also `lib/sfdpgen/sfdpinit.c:214` where the attr is read.

**TS location:**
- `src/layout/sfdp/init.ts:158-160` (getSizes skips |edgelabel| branch)
- `src/layout/sfdp/spring-driver.ts:192-194` (embedding skips edgelabel path)
- `src/layout/sfdp/index.ts:61` (post-layout label node extraction skipped)

**Reachability:** ATTR — requires `label_scheme=N` (N in 1–4) on the
graph. Default is 0 (no edge label repositioning). Used when sfdp is
asked to optimize edge label placement as part of the force model.

**Downstream visual impact:** MEDIUM — edge labels in sfdp graphs with
`label_scheme>0` will appear at their default mid-edge position rather
than being repositioned for minimum overlap. No throw, just incorrect
label positions.

**Algorithm:** Adds virtual "|edgelabel|" nodes to the adjacency matrix,
one per labeled edge, connected to the edge's tail and head. The force
model then positions these virtual nodes as part of the embedding. Post-
layout they are read back as label positions.

**Dependencies:** The sparse matrix construction in `init.ts:makeMatrix`
needs to include the virtual label nodes. The embedding in
`spring-driver.ts` needs to handle the augmented matrix. Then the
post-layout extraction in `index.ts` needs to copy positions back.

**Estimated size:** ~250 LOC across 3 files.

---

## SFDP-3: `prism` overlap removal (ntry > 0)

**Status:** THROWS — `src/layout/sfdp/spring-driver.ts:180-183` throws
when `ntry > 0`.

**C reference:** `lib/neatogen/overlap.c:remove_overlap` (line 486),
the `ntry > 0` branch starting at line 528. Called from sfdp via
`lib/sfdpgen/spring_electrical.c` → `multilevel_spring_electrical_embedding`.

**TS location:** `src/layout/sfdp/spring-driver.ts:160-183`.

**Reachability:** ATTR — controlled by sfdp's `overlap` attribute. The
default for sfdp is `prism0` (ntry=0, initial scaling only). Only
`overlap=prism` or `overlap=prismN` (N>0) triggers the actual prism
algorithm. An explicit `overlap=prism` attribute is required.

**Downstream visual impact:** MEDIUM — with `overlap=prism` and overlapping
nodes, the prism overlap removal is not applied; nodes remain overlapping.
The port throws rather than leaving nodes overlapping, which is better
than silent divergence but worse than correct behavior.

**Dependencies:** Shared with NEA-6 and FDP-3: requires the VPSC solver
and the prism OverlapSmoother from `lib/neatogen/overlap.c`. This gap
cannot be fixed without first addressing NEA-6.

**Estimated size:** ~400 LOC (overlap.c is ~600 lines; the prism section
is ~150 LOC, with VPSC another ~250 LOC). Shared with NEA-6 / FDP-3.

---

## SFDP-4: `QUAD_TREE_NONE` / `QUAD_TREE_FAST` force accumulation

**Status:** Not ported — `src/layout/sfdp/quadtree.ts:6` and
`src/layout/sfdp/spring-electrical.ts:16-17` note these paths are
unreachable at defaults and not ported.

**C reference:** `lib/sfdpgen/spring_electrical.c:550` (QUAD_TREE_NONE /
FAST branch, called when `n >= quadtree_size` and scheme is FAST or
large HYBRID). `lib/sfdpgen/spring_electrical.c:713` (another call site).

**TS location:** `src/layout/sfdp/spring-electrical.ts:16-17`,
`src/layout/sfdp/quadtree.ts:6`.

**Reachability:** ATTR — controlled by `quadtree=none` or `quadtree=fast`
on the graph. Default is `quadtree=normal` (which uses the NORMAL scheme,
already ported). `QUAD_TREE_HYBRID` switches to FAST only for graphs
larger than `QUAD_TREE_HYBRID_SIZE` (512 in C); the port uses NORMAL for
all sizes.

**Downstream visual impact:** LOW — the FAST scheme is a pure performance
optimization; it uses a direct-force accumulation tree traversal instead
of the per-node supernode query. The position results are slightly different
(different approximation strategy) but not visually wrong. Users setting
`quadtree=fast` get the NORMAL scheme instead, which is more accurate but
slower for large graphs.

**Dependencies:** The `QuadTree.c` FAST force accumulation path. The
quadtree data structure is already ported; only the traversal strategy
differs.

**Estimated size:** ~150 LOC.

---

## SFDP-5: `smoothing != none`

**Status:** THROWS — `src/layout/sfdp/init.ts:113-118` throws when
`smoothing` attribute is anything other than `none`.

**C reference:** `lib/sfdpgen/sfdpinit.c:214` (`ctrl->smoothing = late_smooth(...)`),
`lib/sfdpgen/spring_electrical.c` (post-process smoothing called after
the main embedding). `SMOOTHING_SPRING`, `SMOOTHING_TRIANGLE`, etc.

**TS location:** `src/layout/sfdp/init.ts:112-118` (throws),
`src/layout/sfdp/spring-driver.ts:241` (rotation also not ported).

**Reachability:** ATTR — requires `smoothing=spring` (or `triangle`,
`rng`, `stress_majorization_*`) on the graph. Default is `none`.
These are post-processing steps applied after the spring-electrical
embedding to smooth the node positions.

**Downstream visual impact:** LOW — the smoothing post-process improves
aesthetic quality but does not change graph topology. Graphs without
explicit `smoothing` attr are unaffected. The throw means any graph
with the attr produces no output rather than unsmoothed output.

**Dependencies:** Multiple smoothing algorithms (spring, triangle, RNG,
stress majorization variants). Each is a self-contained post-process.
Spring smoothing (~100 LOC) is the simplest; triangle smoothing requires
Delaunay triangulation (~300 LOC).

**Estimated size:** ~300 LOC for all smoothing variants. The most
commonly used (`spring`) alone is ~100 LOC.
