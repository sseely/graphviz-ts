# structural-match edge-path bucket — diagnosis

Scope: 28 `structural-match` ids whose worst numeric diff is an edge `<path>`
`@d`, plus the single `node-ellipse` outlier 2521. Diagnosis only — no port
source, no `parity.json`, no fix diffs.

## Summary table

| sub-cluster | ids | count | family | tractability | ref |
|---|---|---:|---|---|---|
| hub-fanin long-edge chain divergence | linux.i386-b29, share-b29, graphs-b29, windows-b29 (×4 b29), share-b124, graphs-b124, windows-b124 (×3 b124), graphs-b100, graphs-b104 | 9 | other-named (long-edge-groupSize) | needs-C-instrumentation | plans/fix-graphs-b15/ + .agent-notes/graphs-b15-collect-design.md |
| labeled 2-cycle back-edge vspace | 2413_1, 2413_2 | 2 | NOVEL | needs-C-instrumentation | — |
| splines=ortho equal-cost corridor tie-break | 56, 1856, 2361 | 3 | ortho-tiebreak | needs-C-instrumentation | .agent-notes/2361-ortho-maze-corridor-tiebreak.md |
| x-coord/rank NS degenerate-optimum tie-break (LR_balance) | 1447_1 | 1 | LR_balance | known-mechanism | .agent-notes/path-structure-1447.md, .agent-notes/b51-blok60-is-xcoord-ns-selection.md |
| x-coord/rank NS degenerate-optimum tie-break (mincross/ns pivot) | 2371, 2521 | 2 | xcoord-ns | known-mechanism | .agent-notes/2371-is-xcoord-ns-solution-selection.md, .agent-notes/path-structure-rank-extent.md |
| Proutespline findMaxDev symmetric-tie / Apple-libm hypot | 2368, 241_1 | 2 | hypot-ulp | accepted-portability | .agent-notes/2368-residual-flat-label-ranksep.md, flat-edge-241-is-y-only.md (memory) |
| compass-port ictxt ray-cast on IS_BOX shapes | graphs-sl_box, graphs-st_box, graphs-st_box_dbl, graphs-sr_box, graphs-ports, linux.x86-ports_dot, nshare-ports_dot | 7 | ports-geometry | known-mechanism | src/common/compass-port.ts:292-300 vs lib/common/shapes.c:2902-2903 |
| flat-adjacent aux back-edge swap orientation | 1949 | 1 | other-named | known-mechanism | .agent-notes/1949-diagnosis.md |
| record-port sub-port small residual | 2646 | 1 | NOVEL | needs-C-instrumentation | — |
| self-loop box-wall round() sub-pixel | graphs-honda-tokoro | 1 | other-named (bbox-class-control-hull) | accepted-portability | honda-samehead-shared-port.md (memory), bbox-class-control-hull-vs-curve.md (memory) |

Total: 9+2+3+1+2+2+7+1+1+1 = **29**.

## hub-fanin long-edge chain divergence (b29/b124/b100/b104)

**Evidence.** For all 4 b29 platform copies and all 3 b124 copies, every node
`<ellipse>`/`<polygon>` position is byte-identical port vs. oracle (0.00 delta
on every node checked via `flat-geom-diff.mjs`); the entire divergence is on 2-3
specific `<path>` elements per graph, each thousands of px off
(b29: 2559/2183/2016 on edges into `Node14650`; b124: 1988/1507/1039 on edges
into `09AC0A6A`/`11404EC3`/`F95C2F6D`). Both b29's `Node14650` and b124's hub
nodes have dozens of in/out edges (`grep -c` 12-20 occurrences), i.e. these are
long, multi-rank edges converging on a high-fan-in/fan-out node — exactly the
topology the currently-open `graphs-b15` mission (this repo's own
`fix/graphs-b15-edgecmp` branch, docs-only on disk) is diagnosing:
`dotSplines_`'s group/`getMainEdge` dispatch fragmenting or double-installing
chain segments for edges that pass through a shared merge/virtual node
(`.agent-notes/graphs-b15-collect-design.md`, `plans/fix-graphs-b15/decision-journal.md`
— "groupSize fragments chain segments" / "long-edge doubling", maxDelta 432
class). `graphs-b100`/`graphs-b104` are the SAME dot source (`diff` = 0 lines)
rendered under two corpus paths, and their lone divergent edge
(`Node23730->Node23729`, Δ20.00) also targets a high-fan-in hub (`Node23729`
has 6+ in-edges) with every node position exact — the same signature at smaller
magnitude.

**Ruled out:** x-coordinate/rank shift (every node position matches to 0.00,
so this is not `LR_balance`/`xcoord-ns`); self-loop space bugs (`Node14650`'s
self-loop has no ports, so it dispatches to the already-faithful `selfRight`,
not the buggy `selfTop`/`selfLeft` paths below); bbox/translate mismatch (bbox
width/height/translate are byte-identical C vs port for every id in this
sub-cluster).

**Confidence:** moderate — the hub-fanin signature (node positions exact,
only multi-segment edges into a heavy hub diverge) strongly matches the b15
mechanism class by pattern, but b29/b124/b100 have not been individually
C-instrumented (only b15 itself has a paired C/port dump). Flagged
`needs-C-instrumentation`, not `known-mechanism`, for these 4 specific ids.

## labeled 2-cycle back-edge vspace (2413_1, 2413_2)

**Evidence.** Both are `rankdir=LR` graphs with a short cycle of labeled
forward edges (`"clones"`) plus labeled reverse back-edges (`"is cloned by"`)
between the same node pairs. `flat-geom-diff.mjs` shows a **uniform** node
shift (2413_1: every one of its 4 nodes off by exactly 24.21; 2413_2: several
nodes off by exactly 24.21 too) plus a bbox height delta (2413_1: -30,
2413_2: -41) — the same "uniform internal-frame shift from a bbox/height
miscalculation" signature seen in the `ports-geometry`/self-loop cluster below,
but here driven by the back-edge label height reservation for a 2-node cycle,
not self-loops. The worst edges (2413_1: `JI-35559->JI-36281` Δ67.65;
2413_2: `LVM-2346->JA-2839` Δ99.55, `JI-42861->JI-43515` Δ99.54,
`JI-42130->JI-41529` Δ67.65) repeat the *same* 67.65 value across the two
otherwise-unrelated graphs, which is strong evidence of one shared, deterministic
mechanism rather than per-graph coincidence.

**Ruled out:** the already-fixed `2cycle-backedge-fix-done` class (class2
back-edge double-count via fast-graph vs cgraph iteration) — that fix is
already landed per memory and is a *node-arrangement* bug; here node
X-positions within a rank are unaffected, only a uniform Y/height shift plus
specific edge-spline deltas remain, so this is a residual, different mechanism
downstream of that fix, not a recurrence of it.

**Confidence:** low-moderate on family boundary; the uniform-shift diagnostic
technique is solid, but the exact C origin (rank.c edge-label vspace for a
2-cycle under `rankdir=LR`, vs. the back-edge chain router) was not
C-instrumented in this pass. Marked NOVEL, `needs-C-instrumentation`.

## splines=ortho equal-cost corridor tie-break (56, 1856, 2361)

**Mechanism.** All three set `splines=ortho` explicitly. `flat-geom-diff.mjs`
confirms every node position is byte-identical port vs. oracle for all three
(0.00 on every node), while specific edge `<path>`s diverge by large amounts
(56: up to 618.00; 1856: up to 108.00; 2361: 144.13, matching `parity.json`
exactly). This is the already-instrumented `2361-ortho-maze-corridor-tiebreak`
class: node boxes, maze cell partition, and Dijkstra cost model are all proven
faithful to C (`ortho.c`/`sgraph.c`/`fpq.ts`), so C and the port compute the
identical cost for a given route; the divergence is *which* equal-cost
L/Z-shaped corridor the maze search reaches first, a snode/adjacency
exploration-order tie-break, not a cost or geometry bug.

**Origin:** `src/layout/dot/ortho/*` maze/route dispatch (no single line — the
prior investigation ruled out maze *construction* order as the driver and
left the true tie-break locus open).

**Ruled out:** maze cell partition/weights (verified identical); `edgeLen`
formula (fixed separately, verified faithful post-fix); maze-construction
order (`partition.ts`'s `traverse_polygon` branch table — A/B tested
byte-identical on 17 ortho corpus files including 2361's exact geometry, per
`.agent-notes/2361-ortho-maze-corridor-tiebreak.md`).

**Confidence:** high on what's ruled out, low/open on the true mechanism —
explicitly logged as "genuinely open" in the source note. `needs-C-instrumentation`.

## x-coord/rank NS degenerate-optimum tie-break — LR_balance (1447_1)

**Mechanism.** 1447_1's ranks and in-rank order are byte-identical to C at
every rank (mincross fully conformant); several "diamond convergence" nodes
(equal in-weight/out-weight pass-through or merge points) land on a different
but *cost-equal* optimal x than C. Proven via a degree-2 symmetric-weight
cost-invariance argument (any x in a bounded interval gives the identical
total weighted edge length) plus paired C/port `XNSDBG` instrumentation
showing the divergence originates inside `LR_balance`
(`lib/common/ns.c:778` / `ns.ts::lrBalance`), driven by the `Tree_edge` list's
add-order (`feasibleTree`/`tightTree`'s inter-tree-edge merge phase,
`ns-subtree.ts`) diverging from C's `tight_tree`. The `splines=ortho` `@d`
divergence for 1447_1 (matching `parity.json`'s maxDelta 284) is downstream of
these node-x shifts (ortho routing runs after position assignment), not an
independent maze tie-break — confirmed by checking every large-delta edge
touches a proven x-shifted node.

**Ruled out:** mincross/order divergence (byte-identical per-rank order);
the already-fixed `labelVnode` nodesep bug (blok_60's specific root cause —
1447_1 has zero clusters and zero edge labels, so that code path never
fires); an independent ortho maze tie-break as the *primary* cause (every
large-delta edge touches an x-shifted node).

**Confidence:** high (paired instrumentation pinned the exact divergent
`Tree_edge` list index). `known-mechanism`, but the fix (replicate C's
`tight_tree` edge-add/merge order) is flagged corpus-wide-regression-risk in
the source note, not attempted here.

## x-coord/rank NS degenerate-optimum tie-break — mincross/ns pivot (2371, 2521)

**2371.** Direct re-render + `flat-geom-diff.mjs` confirms every node position
now matches C exactly (0.00) — the mass x-coordinate divergence this graph
was originally famous for (maxΔ 12524, then 651 on the `combo_all` repro) was
already root-caused and fixed: `rcross`'s `Count` array was indexed by
*absolute* `ND_order` instead of the *component-window-relative* order during
multi-component mincross, producing `NaN` crossing counts that permanently
disabled `save_best` for components after the first
(`.agent-notes/2371-is-xcoord-ns-solution-selection.md`, "RESOLVED" section).
The current residual (`parity.json` maxDelta 16.80, 2 edges:
`r6837mid--r9687mid`, `r38mid--r8699mid`) is a small post-fix leftover with
node positions unaffected — a distinct, much smaller-magnitude tie than the
original mass divergence, not yet independently re-instrumented.

**2521.** `mark_clusters`'s `UF_singleton` reset interacts with
path-compression asymmetry from the 3 cross-cluster `{rank=same}` blocks to
produce a genuinely *contradictory* pair of SLACKNODE constraints
(`c1 >= a1+1` and `a1 >= c1+1` simultaneously); network simplex resolves the
contradiction by satisfying one and slacking the other, and *which* one is a
pivot/entering-edge-order question inside `ns.ts`/`ns.c`, not a topology
question. The UF/cluster/`class1` topology itself was proven byte-for-byte
faithful to C (matching C's own `-v5` verbose network-simplex node/edge
counts exactly: 7 nodes 8 edges then 1 node 0 edges). A separate, real
`ufUnion` tie-break field bug (comparing cgraph's global AGID instead of the
dotgen-only `ND_id`, which is always 0 under plain `dot`) was found and fixed
in a related investigation, collapsing 2521's divergence from a multi-node
rank mismatch down to the single 7pt residual `parity.json` now records
(`svg/g[1]/g[15]/ellipse[1]/@cx`, maxDelta 7) — a node-ellipse position, not
a path, but included per this bucket's scope.

**Ruled out (2521):** cluster-membership eviction (byte-identical warning
sets); `GD_leader`/leader selection (verified via C's own verbose trace);
edge-classification topology (`class1Edge`/`interclust1` — instrumented,
byte-identical node/edge counts to C); `virtualNode` id=0 (proven faithful —
C's `virtual_node()` never calls `agnode()` either, so id=0 is correct in
both).

**Confidence:** high on mechanism for both (paired instrumentation for 2371's
original bug; C-matching verbose-log evidence for 2521). `known-mechanism`,
though the residual magnitude is now small enough that further chasing is a
pivot-order study, not a simple omission.

## Proutespline findMaxDev symmetric-tie / Apple-libm hypot (2368, 241_1)

**Mechanism.** 2368's sole remaining edge (`376->76`, `parity.json` maxDelta
10.22 exactly) is a geometrically symmetric down-arc funnel that C's
`Pshortestpath`/`Proutespline` splits toward a different corner than its two
translationally-identical siblings (`256->436`, `376->196`) purely from
~1e-14 floating-point cancellation noise in absolute-coordinate bezier
evaluation — C's own output is *self-inconsistent* across the three
congruent arcs. The port's `findMaxDev` (`src/pathplan/route.ts`) is
translation-*equivariant* (same channel anywhere gives the same spline), so
it agrees with C on 2 of 3 and diverges only where C's own noise flips sign.
Measured bit-identical rates against the oracle's Apple-libm `hypot` across
several candidate implementations (V8 `Math.hypot` 62.9%, correctly-rounded
84.3%, fdlibm 89.7%, plain `sqrt` 94.4% in this magnitude regime) show no
portable implementation matches Apple's libm well enough to close this without
regressing other oracle-pinned unit tests (`#241_0` translation-equivariance,
`splines-flat-multi` cnt=3) — confirmed by a reverted experiment. 241_1
(maxDelta 2.36, same-rank compass-port flat edges with `tailport=n
headport=n`) is the sibling GitLab-#241 test file to the already-closed
`#241_0` (`flat-edge-241-is-y-only.md`), sharing the same flat-edge/pathplan
routing family and the same small-tie-break signature; its nodes use `shape=
square` (C polygon `p_square`, NOT `p_box`), so it does **not** fall under
the `IS_BOX` ray-cast bug below — its residual is consistent with the same
`findMaxDev`-class numerical tie, not yet independently re-instrumented for
this specific file.

**Ruled out:** for 2368, a genuine cost/algorithm bug (C's own route dump
shows the tie is real and symmetric); the port's `hypot`/`dist` primitive
being simply "wrong" (tested `sqrt`-based faithful reimplementation —
survey-neutral but regressed 2 pinned unit tests, so the current tolerant
equivariant behavior is the deliberate, correct design). For 241_1: the
`IS_BOX` compass-port bug (nodes are `shape=square`, which uses a different C
polygon struct than `shape=box` and therefore legitimately ray-casts in both
C and the port).

**Confidence:** high for 2368 (extensively instrumented, decision documented
as a deliberate accepted design). Moderate for 241_1 (family match by
topology/magnitude/provenance, not independently re-instrumented in this
pass). `accepted-portability` for both.

## compass-port ictxt ray-cast on IS_BOX shapes (self-loop box tests + ports)

**Mechanism.** C's `poly_port` (`lib/common/shapes.c:2880-2910`) resolves a
whole-node compass port (`bp == NULL`, i.e. not a record/HTML sub-port) by
checking `IS_BOX(n)` (`ND_shape(n)->polygon == &p_box`, `shapes.c:205-207`):
if the node's shape is literally `box`/`rect`/`rectangle` (all three share the
`p_box` polygon struct, `shapes.c:293,318-319`), `ictxtp = NULL` and the
compass point is the **trivial, exact** bbox-corner/edge-midpoint formula
computed earlier in `compassPort`. For every *other* shape (ellipse, polygon,
`square` — which uses a **distinct** `p_square` struct, `shapes.c:320` — etc.)
C sets `ictxtp = &ictxt` and ray-casts via `compassPoint`
(`bezier_clip` against the shape's `insidefn`, `shapes.c:2650-2672`). The
port's `applyIctxt` (`src/common/compass-port.ts:292-300`) has **no such
exclusion**: it calls the ray-cast (`compassPoint`/`bezierClip`) for *any*
whole-node compass port whose node has an `insidefn` — including
`shape=box` nodes. `bezierClip`'s iterative bisection does not converge
exactly onto a rectangle's corner (a singular point of the "inside" boundary
test), so it lands several to ~150px off C's exact corner for box-shaped
nodes specifically. Direct evidence: `graphs-st_box`'s `node37` self-loop
path start point is `77.8,-1010.18` in the port vs. `98.12,-1009.8` in C —
C's value is **exactly** `node37`'s own NE bbox corner (verified from the
node's `<polygon>`); the port's is not, even though `node37`'s bbox itself is
byte-identical between C and port. The resulting wrong tail/head port point
feeds directly into `selfTop`/`selfLeft`/`selfBottom`/`selfRight`'s
(`src/common/splines-selfedge.ts`) geometry construction (`tp`/`hp` are
inputs to every downstream `dx`/`dy` formula), producing the large,
point_pair-correlated deltas seen in `graphs-st_box`/`graphs-st_box_dbl`
(up to 27.13, concentrated exactly on the `TOP_DX_SET_C` point-pair branches
37/51/57) and `graphs-sl_box` (up to 143.35, `selfLeft`'s equivalent
branches), and the smaller `graphs-ports`/`ports_dot` residuals (up to 10.60,
on `a:ne->d:n` etc. — node `a` is `shape=box` per `node[shape=box]`) and
`graphs-sr_box` (up to 10.22 — `selfRight`'s branches have no per-point-pair
magnitude formula beyond a sign flip, so the same ray-cast error surfaces at
smaller, more uniform magnitude here).

**Origin:** `src/common/compass-port.ts:292-300` (`applyIctxt`), missing the
`IS_BOX(n)` guard present in `lib/common/shapes.c:2902-2903` (`poly_port`).

**Ruled out:** the `selfTop`/`selfLeft`/`selfRight`/`selfBottom` geometry
formulas and their `point_pair` lookup table (`TOP_DX_SET_C`/`TOP_DX_SET_E`,
`SIDE_PAIR_A`) — verified byte-identical to
`lib/common/splines.c:convert_sides_to_points`/`selfTop`/`selfBottom` by
direct side-by-side source comparison; `selfRightSpace`'s `goesRight` gating
(the already-fixed flip-aware space-reservation bug) — verified faithful,
not implicated here; record-port resolution (2646's `nb_part` field ports) —
C's `record_port` (`shapes.c:3732-3756`) always passes `ictxt=NULL` regardless
of shape, and the port's `compassPort` already gates `applyIctxt` on
`bp === null`, so record/field sub-ports correctly never ray-cast in either
implementation — this rules OUT 2646 from this family (see below); A2
font-metric estimation as the *primary* driver for `st_box`/`sl_box` — their
deltas (100+ px) are far larger than plausible font-metric noise and
correlate exactly with specific `point_pair` branches, not label text length.

**Confidence:** high — root cause pinned by direct C-source comparison
(`shapes.c:2902-2903` vs. the port's unconditional `applyIctxt`) plus a
concrete endpoint-coordinate mismatch on a real corpus node. `known-mechanism`.

## flat-adjacent aux back-edge swap orientation (1949)

Already fully diagnosed in `.agent-notes/1949-diagnosis.md`: after fixing an
unrelated `cloneNode` fontsize/defaults-snapshot bug (which took 1949 from
diverged to structural-match), the residual (`parity.json` maxDelta 100.89,
`structParty:S->structDefaultAuto`) is a genuine conflict between two flat-
adjacent aux back edges — 1949's `:S` edge needs `clipAndInstall`'s
compensating `swapSpline` **skipped** (the port's `routeRegularEdgeFaithful`
pre-orients it), while `#241_0`'s aux back edge needs the swap **kept** — and
both present identical local state (`sflagBefore=1`), so no per-edge gate can
distinguish them without a broader fix to which end (`sp`/`ep`) carries the
clip flag in the port's forward-edge routing. `known-mechanism`, explicitly
documented as blocked on a shared, higher-risk file (`edge-route-faithful.ts`/
`splines-clip.ts`) rather than a flat-adjacent-scoped change.

## record-port sub-port small residual (2646)

`flat-geom-diff.mjs` shows every node position byte-identical (0.00); only 3
of many `nb_part`/`masse`/compass-direction record-field edges diverge, by a
modest 27-42px (`parity.json`'s recorded 42.09 as maxDelta). As established
above, 2646's `shape=record` nodes route their named sub-ports through C's
`record_port`, which never ray-casts (`ictxt` always `NULL`), so this is
**not** the `IS_BOX` bug. No alternative mechanism was confirmed in this
pass (would need a paired C/port dump of the specific `nb_part` port-point
resolution and the `dot -Godb=r` route for these 3 edges). `NOVEL`,
`needs-C-instrumentation`.

## self-loop box-wall round() sub-pixel (graphs-honda-tokoro)

`parity.json` maxDelta 1.06 (measured here 1.00), a single edge `n012->n011`.
Fully diagnosed in the `honda-samehead-shared-port` investigation (memory):
the shared port (`buildSharedPort`) and the parallel grouping are both
conformant to C; the 1px divergence is `maximal_bbox`'s head-corridor box
wall installing both `n012->n011` parallels at internal x=90 in C vs. x=89 in
the port — a floating-point rounding-boundary artifact of the same
`round()`/box-wall class already documented in
`bbox-class-control-hull-vs-curve.md`, not a logic gap (the port's
`maximal_bbox` formula already mirrors C's exactly). Explicitly left as-is:
fixing `round()` in `maximal_bbox` is a primitive shared by every corpus
edge, corpus-wide regression risk for 1px on 2 edges. `accepted-portability`.

---

edge-path: 29 cases → 10 sub-clusters; 27 attributed (2 NOVEL, needs further
C-instrumentation: labeled 2-cycle back-edge vspace [2413_1/2413_2], record-port
sub-port residual [2646]); top candidate = ports-geometry (7, `known-mechanism`,
root cause pinned at `src/common/compass-port.ts:292-300` vs.
`lib/common/shapes.c:2902-2903`).
