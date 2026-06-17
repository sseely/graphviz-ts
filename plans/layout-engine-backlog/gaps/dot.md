# dot Layout Engine — Porting Gaps

## DOT-1: `make_regular_edge` / pathplan spline routing

**Status: routing DONE (mission-dot-splines, merged 2026-06-17).** Every *single*
regular dot edge — adjacent / multi-rank / back / non-forward, all rankdirs — now
routes through the faithful pathplan path (`routeRegularEdgeFaithful` /
`routeMultiRankEdgeFaithful` + `routeSplines`). Fixed the re-verification's core
bugs (wide fan-out/in outer-edge stub collapse; rankdir=LR span drift), oracle-
pinned in `edge-route-splines.test.ts`. 115 goldens byte-identical.

**DOT-1b: retire the simplified fitter — DONE for regular edges
(mission-dot-1b, merged 2026-06-17).** Every regular dot edge now routes through
the faithful pathplan path, and the simplified *regular-edge* fitter is deleted:
- T1: adjacent back edges (b->a, 1 rank) route faithfully via `makeFwdEdge`
  (C `makefwdedge`) → `routeRegularEdgeFaithful` → `clipAndInstall`.
- T3: parallel/opposing groups (`routeParallelEdgeGroup`) route the shared base
  via the faithful primitives; back members install through `makeFwdEdge` and are
  reversed to tail→head. Opposing `b->a` is byte-exact to the dot oracle.
- T4: deleted the now-dead regular-edge fitter — `routeFwdMultiRankEdge`,
  `routeEdgeRaw`, `fitterBackFwdPoints`, `applyEndArrows`, `computeSplineMulti`,
  the `makeRegularEdge` stub, the `straightEdgeSpline` alias, the chain-corridor
  helpers (`buildChainBoxes`/`buildBackEdge*Box`/`walk*VirtChain`), and the T1
  measurement scaffolding — all grep- and suite-proven unreachable.

**Residual (out of DOT-1b's regular-edge scope) — `straightEdgeSplineWithRank` +
its subtree (`routeWithRank`/`routeSimple`/`buildRankCorridor`/`clipToNodes`/
`computeSpline`/`routeBezier`/`polyEdgesFromPts`) is KEPT** because the FLAT-edge
path still uses it: same-rank edges whose faithful flat / side-port routers decline
(flat side-port loops, non-adjacent flat labels) fall back to it via
`routeForwardEdge`. No regular edge reaches it (proven by instrumentation: only
flat-edge unit tests hit that fallback; 115 goldens never do). Retiring the fitter
for flat edges is a separate flat-routing mission.

**(historical) Original status:** Stub — `makeRegularEdge` in `splines-route.ts:254`
is a no-op.

**C reference:** `lib/dotgen/dotsplines.c:make_regular_edge` (line 1700),
calls `routesplines` (line 1800, 1850), then
`clip_and_install` (lines 1880, 1892, 1905).
`routesplines` lives in `lib/pathplan/route.c`.

**TS location:** `src/layout/dot/splines-route.ts:254` (empty body),
`src/layout/dot/splines.ts:340-368` (entry point comment),
`src/layout/dot/splines-flat.ts:97,121` (flat routing also deferred).

**Reachability: NEEDS RE-VERIFICATION — the DEFAULT/CRITICAL rating below
was disproven by an orchestrator oracle check (2026-06-13).** Every
regular edge does pass through `make_regular_edge` /
`routeParallelEdgeGroup`, but the rank-corridor spline path
(`edge-route-poly.ts:computeSpline`) is NOT a straight-line fallback — it
reproduces C's Beziers. Evidence: `digraph { a->b->c; a->c }` renders
edge `<path>` data **byte-identical to `dot` 15.0.0**, including the `a→c`
edge bowing around `b` at x=63. So the headline "all regular edges are
straight lines" is FALSE for standard graphs, and the 82 goldens (which
ARE generated from `dot -Tsvg` 15.0.0, not from the port) confirm the
default path matches C.

What `pathplan` actually gates is the general polygon-obstacle shortest-
path router used by C's `routesplines` in harder cases (dense corridors,
port-constrained endpoints, routing around cluster boxes). The real
deferral is real but NARROW. **Action before promoting this to a mission:
build a corpus of inputs and diff each against `dot -Tsvg` to find the
exact cases where the port's corridor spline diverges from C — that set,
not "every edge," is the mission's true scope and priority.**

**Downstream visual impact: UNCLEAR until the above re-verification.**
Standard multi-rank routing already matches C. The impact is bounded to
whatever subset of obstacle/port/cluster routing hits the pathplan stub.

**Dependencies:** Requires porting `lib/pathplan/` (route.c, shortest.c,
vis.c, triang.c, ~2,000 LOC). The path plan port (T14 in the original
mission) scaffolded types but did not implement `routesplines`.

**Estimated size:** ~1,200 LOC new TS (pathplan algorithms) +
~400 LOC updates to `make_regular_edge`, `make_flat_edge`, and
`clip_and_install` wiring in `splines-route.ts` and `splines-flat.ts`.
Total: ~1,600 LOC across 4-6 files.

**Notes:**
- `clip_and_install` (`lib/common/splines.c:clip_and_install`) also
  partially missing; the TS version in `edge-route-clip.ts` does simple
  geometry but not the full obstacle-aware variant.
- Flat edge routing (`make_flat_edge`, line 1502) shares the pathplan
  dependency; do both in the same mission.
- The golden refs for dot were generated with the straight-line stub and
  will need to be regenerated after this mission.

---

## DOT-2: `make_flat_edge` / flat spline routing

**Status:** LARGELY DONE (2026-06). Side-port flats (`routeFlatEdgeFaithful`),
adjacent flats (`makeFlatAdjEdges`), non-adjacent labeled flats
(`make_flat_labeled_edge`, mission dot-flat-labels), and no-port labeled
adjacent flats incl. parallel stacking (`makeSimpleFlatLabels`) all route via
the ported pathplan and match dot 15.0.0 byte-exact. Remaining flat sub-gaps
are tracked separately: DOT-9 (no-port no-label `makeSimpleFlat`) and DOT-10
(port-bearing adjacent labeled flats). The notes below are historical.

**C reference:** `lib/dotgen/dotsplines.c:make_flat_edge` (line 1502),
calls `routesplines` (line 1603) and `clip_and_install` (line 1610).

**TS location:** `src/layout/dot/splines-flat.ts`

**Reachability:** ATTR — requires `rank=same` edges that also carry a
label, triggering the flat-edge virtual-node path through
`flatLabeledEdges`. Uncommon but legitimate DOT input.

**Downstream visual impact:** HIGH for affected graphs — labeled flat
edges render as straight lines instead of curved arcs between same-rank
nodes.

**Dependencies:** Blocked on DOT-1 (pathplan). Same mission.

**Estimated size:** ~300 LOC (small relative to DOT-1 because the box
geometry is already partially in place).

---

## DOT-3: `fillRanks` / `realFillRanks` / `newrank` mode

**Status:** Stub — `src/layout/dot/mincross-build.ts:258` (`fillRanks` is a no-op).
Also `src/layout/dot/init.ts:245` notes the fill-node removal stub.

**C reference:** `lib/dotgen/mincross.c:fillRanks` (line 1014),
`lib/dotgen/mincross.c:realFillRanks` (line 976).
Guard: `lib/dotgen/rank.c:523` (`if (mapbool(agget(g, "newrank")))`).

**TS location:** `src/layout/dot/mincross-build.ts:258-260`,
`src/layout/dot/init.ts:239-245`.

**Reachability:** ATTR — triggered by graph attribute `newrank=true`.
This is a non-default attribute used in complex multi-rank compound
graphs where the user wants globally consistent rank assignment.

**Downstream visual impact:** HIGH for graphs that use `newrank=true`:
without `fillRanks`, placeholder nodes are never inserted, so rank
alignment across subgraphs is wrong. The current port returns silently,
leaving compound graphs with misaligned ranks.

**Dependencies:** None outside dot engine. The rank data structures are
already in place. This is a self-contained addition to the mincross phase.

**Estimated size:** ~250 LOC across `mincross-build.ts` and `init.ts`.

---

## DOT-4: `expand_leaves`

**Status:** Stub — `src/layout/dot/position.ts:173` is a no-op.

**C reference:** `lib/dotgen/position.c:expand_leaves` (line 1015),
called at line 138 of `dot_position` after `make_leafslots`.

**TS location:** `src/layout/dot/position.ts:173-176`.

**Reachability:** ATTR — only affects graphs that use `LEAFSET` cluster
expansion, a cluster-packing feature that groups leaf nodes into rank
slots. Triggered when any node has `ranktype == LEAFSET`.

**Downstream visual impact:** MEDIUM — leaf nodes are not expanded into
their slot positions; the graph renders with leaves clustered at the
wrong x-coordinates within the rank.

**Dependencies:** Logically coupled to DOT-3 (newrank/fillRanks) because
both are part of the same compound-graph rank-building path. Best
addressed in the same mission.

**Estimated size:** ~150 LOC.

---

## DOT-5: `checkLabelOrder` / `recResetVlists`

**Status:** Stub — `src/layout/dot/flat.ts:194` (`checkLabelOrder` no-op).

**C reference:** `lib/dotgen/mincross.c:checkLabelOrder` (line 297),
called from `lib/dotgen/flat.c:332`.

**TS location:** `src/layout/dot/flat.ts:194-196`.

**Reachability:** ATTR — requires flat (same-rank) edges that carry labels,
and for `mincross` to have produced a sub-optimal label ordering.
Uncommon combination; triggers only when a graph has multiple labeled
flat edges on the same rank.

**Downstream visual impact:** MEDIUM — label virtual nodes may be placed
in a suboptimal order, increasing visible edge crossings near flat-edge
labels.

**Dependencies:** Requires auxiliary-graph construction for the label
order check. No pathplan dependency. Can be done independently.

**Estimated size:** ~200 LOC in `flat.ts` and helpers.

---

## DOT-6: `nslimit` attribute (nsiter2)

**Status:** Stub — `src/layout/dot/position.ts:140` always returns `INT_MAX`.

**C reference:** `lib/dotgen/position.c:nsiter2` (line 156),
reads `agget(g, "nslimit")`.

**TS location:** `src/layout/dot/position.ts:140-141`.

**Reachability:** ATTR — requires `nslimit=N` on the graph. Extremely rare
in practice; used to cap the network-simplex position phase for very large
graphs.

**Downstream visual impact:** LOW — only affects convergence speed, not
correctness. Without the cap the algorithm runs to full convergence anyway.

**Dependencies:** None.

**Estimated size:** ~20 LOC. Inline fix, not a full mission.

## DOT-7: regular (cross-rank) edge routing ignores the edge type

**Status:** Gap — `edgeType(g)` now reflects the `splines` attribute
(`splines.ts:edgeTypeFromString`, `index.ts:setEdgeTypeFromAttr`, wired
2026-06-16), and `dot_splines_` honors `EDGETYPE_NONE` (skips routing). But
the regular cross-rank routers (`edge-route.ts`, `edge-route-faithful.ts`,
`edge-route-poly.ts`) never branch on `et`: they always emit splines. So
`splines=line` / `splines=polyline` have **no effect on regular edges**.

**C reference:** `lib/dotgen/dotsplines.c:make_regular_edge` (line 1700)
dispatches on `et` (EDGETYPE_LINE → straight, EDGETYPE_PLINE → routepolylines,
EDGETYPE_SPLINE → routesplines).

**TS location:** `src/layout/dot/edge-route.ts:routeForwardEdge` and the
faithful/simplified routers — none read `edgeType(g)`.

**Reachability:** ATTR — `splines=line` / `polyline` on the graph. Flat
labeled edges already honor `et` (DOT-2 done); only regular edges are affected.

**Downstream visual impact:** MEDIUM — `splines=line`/`polyline` graphs render
with curved/spline regular edges instead of straight/polyline. No golden sets
`splines`, so goldens are unaffected.

**Dependencies:** None (the type is already available via `edgeType(g)`).

**Estimated size:** ~1 mission — touches every regular-edge router; needs
oracle pins per edge type.

## DOT-8: `splines=ortho` / `curved` / `compound` routing unported

**Status:** Gap — `edgeTypeFromString` now MAPS these values
(EDGETYPE_ORTHO/CURVED/COMPOUND), but no router implements them. They fall
through to spline routing.

**C reference:** `lib/dotgen/dotsplines.c:dot_splines_` (EDGETYPE_ORTHO →
`orthoEdges`, EDGETYPE_CURVED branch); `lib/ortho/` (orthogonal routing).

**TS location:** `src/layout/dot/splines.ts` (constants exist; no dispatch).

**Reachability:** ATTR — `splines=ortho|curved|compound`. `ortho` needs the
whole `lib/ortho` subsystem (large).

**Downstream visual impact:** MEDIUM for ortho (common request); LOW for
curved/compound.

**Dependencies:** ortho routing needs `lib/ortho` port; depends on DOT-7.

**Estimated size:** ortho is a multi-mission subsystem; curved is smaller.

## DOT-9: `makeSimpleFlat` (no-port, no-label adjacent flats) unported

**Status:** Gap — C's `make_flat_adj_edges` routes a no-port adjacent flat
group with NO labels via `makeSimpleFlat` (a stepped fan when cnt>1). The TS
port handles the LABELED no-port group (`makeSimpleFlatLabels`, done
2026-06-16) but `makeAdjFlatLabeledEdge` declines when the group has no
labels, so unlabeled adjacent parallel flats fall back to the simplified
fitter (single straight line; parallel siblings overlap).

**C reference:** `lib/dotgen/dotsplines.c:makeSimpleFlat` (line ~982).

**TS location:** `src/layout/dot/splines-flat-labeled.ts:makeAdjFlatLabeledEdge`
(declines no-label groups); `src/layout/dot/splines-flat.ts:244` (comment).

**Reachability:** multiple unlabeled flat edges between adjacent same-rank
nodes (e.g. `{rank=same a b} a->b; a->b`).

**Downstream visual impact:** LOW-MEDIUM — parallel unlabeled flats overlap
instead of fanning. Single unlabeled flats are fine.

**Dependencies:** None (pathplan already ported; reuse `simpleSplineRoute`).

**Estimated size:** ~40 LOC — mirror `makeSimpleFlatLabels` without the label
bookkeeping; pin vs dot.

## DOT-10: port-bearing adjacent labeled flats drop the label

**Status:** Partially diagnosed; BLOCKED on DOT-11 (mission dot-flat-residue,
2026-06-17). The copy-back itself is a faithful ~10 LOC change (`copyFlatLabel`
mirroring `dotsplines.c:1273-1277`) and makes the label EMIT instead of drop.
But the emitted position is NOT byte-exact: it inherits an upstream divergence
in how the rotated aux pipeline lays out a *labeled* cross-rank edge — see
DOT-11. A no-port-no-label ported flat is byte-exact to dot 15.0.0
(`M54,-18C56.75,-18 58.79,-18 60.61,-18`), but the labeled aux edge places the
label vnode ~22pt too high (aux-y≈59 vs needed ≈37) and bends the spline wider
(64.24 vs 62.13). The catalogued "~30 LOC: set ED_label.pos during copy-back"
underestimated this: the copy-back is correct but can only be as accurate as
the aux layout it copies. Fix DOT-11 first, then DOT-10's copy-back lands
byte-exact. T2 code for the copy-back was implemented and reverted pending
DOT-11; it is recorded in `plans/dot-flat-residue/decision-journal.md`.

**(historical) Status:** Gap — adjacent flat edges WITH declared ports route via
the rotated auxiliary graph (`makeFlatAdjEdges`), which copies splines back but
not the label position. Only no-port adjacent labeled flats emit their label
(`makeSimpleFlatLabels`, done 2026-06-16).

**C reference:** `lib/dotgen/dotsplines.c:make_flat_adj_edges` (the ports
branch + label handling).

**TS location:** `src/layout/dot/splines-flat.ts:makeFlatAdjEdges`,
`copyFlatSplines`.

**Reachability:** `{rank=same a b} a:e->b:w[label=x]` (adjacent + ports +
label).

**Downstream visual impact:** LOW — narrow case (adjacent + ports + label).

**Dependencies:** DOT-11 (aux pipeline must lay out the labeled cross-rank
edge byte-exact before the copy-back can land the label correctly).

**Estimated size:** ~10 LOC for the copy-back (`copyFlatLabel`) once DOT-11
is fixed. The copy-back alone is implemented+verified-as-faithful but reverted.

## DOT-11: aux pipeline mislays the label vnode for labeled cross-rank edges

**Status:** SPLINE FIXED (mission dot-flat-aux-label, 2026-06-17, merged). The
*wider-spline* half was a reposition bug: `repositionFlatAux` iterated the
named-node Map and skipped the aux graph's virtual nodes; C iterates `GD_nlist`.
Switching to the `nlist` walk (`splines-flat.ts:repositionFlatAux`) made the
labeled-flat spline byte-exact to dot 15.0.0 and corrected the label X. The
*label-Y* half is split out as **DOT-12** (it is NOT label-vnode sizing — see
below). DOT-10 remains blocked on DOT-12.

**(historical) Status:** Gap — discovered 2026-06-17 (mission dot-flat-residue, while
attempting DOT-10). When `make_flat_adj_edges`'s rotated aux graph routes an
edge that carries a center label, the aux pipeline positions the label virtual
node ~22pt too high and bends the spline wider than dot 15.0.0. A *no-label*
ported flat is byte-exact, so the divergence is label-specific and lives in the
aux graph's layout of a labeled cross-rank edge (label-vnode sizing / rank
placement / position phase), upstream of the copy-back.

**Evidence:** input `digraph{ {rank=same; a b} a:e->b:w[label="x"] }`.
- dot 15.0.0: label (72, -32.91); spline `M54,-18C62.13,-18 60.91,-26.42 68.62,-29...`
- graphviz-ts: label (77.6, -54.2); spline `M54,-18C64.24,-18 64.32,-26.48 74.25,-29...`
- aux edge raw: `ED_label.pos = {66.375, 59.25}`, `dimen = {6.75, 16.5}`,
  `del = {11.25, 0}`, flip = false.

**TS location:** `src/layout/dot/splines-flat.ts:makeFlatAdjEdges` (aux pipeline:
`dotInitNodeEdge` → `dotRank` → `dotMincross` → `dotPosition` → `dotSplines_`),
plus the label-vnode placement those phases drive.

**C reference:** `lib/dotgen/dotsplines.c:make_flat_adj_edges` 1200-1232 (the
recursive `dot_rank`/`dot_mincross`/`dot_position`/`dot_splines_` on `auxg`).

**Reachability:** ATTR — `{rank=same}` + ports + label (same trigger as DOT-10).

**Downstream visual impact:** LOW — narrow case, but blocks DOT-10's byte-exact
label. Likely also affects any labeled edge routed through a flat-adj aux graph.

**Dependencies:** None outside the dot aux pipeline; depth unknown (may reach
into the aux graph's label-vnode sizing or the position phase). Needs its own
investigation before promotion.

**Estimated size:** UNKNOWN — pin the aux label-vnode position to C first; the
fix could be small (label sizing) or reach into mincross/position.

## DOT-12: gvPostprocess rotates the flat-adj aux label inconsistently with the spline

**Status:** Gap — precisely diagnosed 2026-06-17 (mission dot-flat-aux-label,
the label-Y residue after DOT-11's spline fix). For a port-bearing adjacent
labeled flat, the aux edge's label ends ~22pt too high even though the spline
is byte-exact. Fully traced — NOT a label-sizing or placement bug:
- `placeVnlabel` (`splines-label.ts`) is byte-identical to C `place_vnlabel`
  and correctly sets the aux label to `y=72` (co-located with the spline mid
  at 71.47) BEFORE postprocess.
- `gvPostprocess(auxg)` then maps spline-mid `71.47 → 29.95` but label
  `72 → 59.25`. It applies a **rankdir rotation** to the aux graph (nodes
  `auxt 117→18`, `auxh 27→18` collapse onto one rank); the rotation maps the
  label via its `pos.x`, which carries the `dimen.y/2` centering offset, so
  that x-offset rotates into a ~22pt y-error. The spline carries no such
  offset, so it stays exact. C's `dotneato_postprocess` keeps the two
  consistent; the TS `gvPostprocess` / aux-flip configuration does not.

**TS location:** `src/common/postproc.ts` (`gvPostprocess` → `translateDrawing`
→ `mapEdge`/`mapLabelPos` rotation), and the aux graph's flip/rankdir setup in
`src/layout/dot/splines-flat.ts:makeFlatAdjEdges` / `repositionFlatAux`.

**C reference:** `lib/common/postproc.c:translate_drawing` / `translate_bb`;
`lib/dotgen/dotsplines.c:make_flat_adj_edges` (reposition + `dotneato_postprocess`).

**Reachability:** ATTR — `{rank=same}` + ports + label (same trigger as DOT-10).

**Downstream visual impact:** LOW — narrow case; blocks DOT-10's byte-exact
label.

**Dependencies / risk:** `gvPostprocess` is SHARED by every graph. A naive fix
risks the 1853 regular-edge goldens — the dot-flat-aux-label AD-2 stop fired
here. Scope a fix to the aux graph's flip config (so postproc rotates label and
spline consistently) and re-verify ALL goldens; do not change non-aux label
rotation.

**Estimated size:** UNKNOWN-but-localized — the inconsistency is pinned to the
postproc label rotation vs spline rotation; the fix is likely in how
`makeFlatAdjEdges` configures the aux graph for `gvPostprocess`.
