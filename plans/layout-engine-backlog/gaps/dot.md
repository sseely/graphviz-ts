# dot Layout Engine — Porting Gaps

## DOT-1: `make_regular_edge` / pathplan spline routing

**Status:** Stub — `makeRegularEdge` in `splines-route.ts:254` is a no-op.

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

**Status:** Stub — `src/layout/dot/splines-flat.ts:97,121` marks the
transform as deferred.

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
