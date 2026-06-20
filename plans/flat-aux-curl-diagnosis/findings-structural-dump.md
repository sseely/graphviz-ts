# T3 Findings: Structural Dump — Named First Divergence

## Summary (first divergence, named)

**Root cause: edge GROUPING.** C groups all adjacent flat edges between a
node pair into ONE `make_flat_adj_edges` call (cnt=N). The port dispatches
each edge in isolation (cnt=1). For the back-edge `3:sw->2:se` this means:

- **C** (cnt=3): the clone enters the aux graph as `auxh(3)->auxt(2)` — a
  BACK edge (rank 1 to rank 0). `dot_splines_` routes back-edges with a
  curl, giving **aux spline size = 7**.
- **Port** (cnt=1): the same edge enters its own isolated aux as
  `auxt(3)->auxh(2)` — a FORWARD edge (rank 0 to rank 1). `dot_splines_`
  routes it straight, giving **aux spline size = 4**.

**C divergence point:** `dotsplines.c:356-360` — the `for (cnt=1; ...)` loop
with `if (ED_adjacent(e0)) continue;` accumulates all adjacent flat edges.

**Port divergence point:** `src/layout/dot/edge-route.ts:297` —
`makeFlatAdjEdges(g, [e], 1, EDGETYPE_SPLINE)` passes a single-element
array; cnt is always 1.

---

## Rank -> direction -> size chain

1. **Grouping** (dotsplines.c:359-360): C cnt=3; port cnt=1 per-edge.
2. **auxt/auxh assignment**: in the joint cnt=3 aux, e0 is the normalized
   first edge (forward `2->3`), so auxt=node2(rank 0), auxh=node3(rank 1).
3. **Clone direction for `3->2`**: `agtail(orig)=3 != tn(2)` ->
   `cloneEdge(auxg, auxh, auxt, e)` -> clone is `auxh(3)->auxt(2)` (rank 1
   to rank 0) = BACK edge in aux.
4. **Port clone direction for `3:sw->2:se`**: port's isolated aux has
   auxt=node3(rank 0), auxh=node2(rank 1); `orig.tail=3 === otn=3` ->
   `cloneEdge(auxg, auxt, auxh, e)` -> `auxt(3)->auxh(2)` = FORWARD edge.
5. **Routing**: C back-edge path in `dot_splines_` produces curl (size 7);
   port forward path produces straight (size 4).
6. **Downstream** (per memory `flat-edge-241-is-y-only`): curl raises
   bezier control points -> bb.ll.y drops -> +7.88 pt up-shift of the
   flat-edge cluster is missing in port -> #241_0 flat-curl-y residual.

---

## #241_0 Confirmation Dump

### C side (ephemeral instrumentation of `make_flat_adj_edges`)

Run: `GVBINDIR=/tmp/gvplugins dot -Tsvg ~/git/graphviz/tests/241_0.dot`
(instrumented build; plugin restored to clean after capture)

```
DIAG241 make_flat_adj_edges: tail=2 head=3 cnt=3
DIAG241   edge[0]: 3->2 tail_port_def=1 head_port_def=1   <- back sw->se
DIAG241   edge[1]: 2->3 tail_port_def=1 head_port_def=1   <- forward ne->nw
DIAG241   edge[2]: 2->3 tail_port_def=1 head_port_def=1   <- plain e->w
DIAG241   aux_spline: 2->3 size=7   <- forward ne->nw curl
DIAG241   aux_spline: 2->3 size=4   <- forward e->w straight
DIAG241   aux_spline: 2->3 size=4   <- hvye straight
DIAG241   aux_spline: 3->2 size=7   <- BACK-edge clone 3:sw->2:se CURL
```

C groups all 3 adjacent flat edges between nodes 2 and 3 into cnt=3.
The `3:sw->2:se` clone is routed as a back-edge -> size=7.

### Port side (harness `test/diagnostic/flat-aux-dump.ts` on `241_0.dot`)

```
forward  2:ne->3:nw  port auxSize = 7  (CANARY: GREEN)
reversed 3:sw->2:se  port auxSize = 4  (BUG REPRODUCED)

One-edge aux dump: 3:sw->2:se
  auxt=3(rank 0), auxh=2(rank 1)
  auxEdge: auxt(3)->auxh(2) sw->se  FORWARD -> size=4
```

Port dispatches `3:sw->2:se` in isolation (cnt=1); clone is FORWARD ->
size=4 (straight).

### Reproduction status

YES -- reproduced identically on #241_0.

The only difference from the synthetic repro is that C groups cnt=3 (three
edges: `3->2`, `2:ne->3:nw`, `2:e->3:w`) rather than cnt=2. The first-
divergence mechanism (back-edge clone direction) is identical. Both synthetic
and real inputs show C=7 / port=4 for `3:sw->2:se`.

---

## FIX HYPOTHESIS -- NOT IMPLEMENTED (next mission)

NOT DONE HERE (AD-1). Diagnosis only.

### Where to change

The port's per-edge flat-adj dispatch in `src/layout/dot/edge-route.ts`
(around line 297) calls `makeFlatAdjEdges(g, [e], 1, EDGETYPE_SPLINE)` for
each adjacent flat edge individually. This must be replaced with a grouping
pass that mirrors C's `dot_splines_` collection loop (dotsplines.c:344-411).

Concretely:
1. Before routing flat adjacent edges, collect all adjacent flat edges
   between each node pair into a group (keyed by unordered {u,v}).
2. For each group, call `makeFlatAdjEdges(g, groupEdges, groupEdges.length,
   EDGETYPE_SPLINE)` once with all edges and cnt=N.
3. Inside `makeFlatAdjEdges`, the back-edge `3->2` will then have
   `otn = edges[0].tail` = node2 (forward e0's tail), so
   `orig.tail (3) !== otn (2)` -> `cloneEdge(auxg, auxh, auxt, e)` ->
   clone is `auxh(3)->auxt(2)` = BACK edge -> `dotSplines_` curls it ->
   size=7.

### Is `rank=source` (T2) also needed?

No -- grouping alone is sufficient for the curl.

The T2 `rank=source` subgraph gap is a real structural gap in the port's
`buildFlatAux` (splines-flat.ts:153 vs C dotsplines.c:1170-1178), but it
does NOT control whether the back-edge curl appears. Evidence:

- C's C-side dump shows maxrank=1 and no virtual nodes in the aux graph for
  the synthetic repro (findings-harness.md). The size-7 curl is produced by
  the back-edge routing path in `dot_splines_`, not by a rank gap >= 2.
- `rank=source` ensures auxt is pinned to rank 0 via `collapse_sets`; this
  affects rank assignment. The curl appears because the clone is a BACK edge
  (rank1->rank0), which `dot_splines_` routes via its back-edge handler
  regardless of absolute rank values.
- `rank=source` should still be ported for correctness of more complex graphs
  but is NOT blocking the #241_0 curl fix.

### Predicted effect of the fix

`3->2` aux size: 4 -> 7 => bb.ll.y drops to match C => +7.88 pt up-shift
of the flat-edge cluster is restored => the #241_0 flat-curl-y residual
closes. Zero regressions expected for the canary `2:ne->3:nw` (already
size=7 in both C and port; grouping does not change its direction).

---

## C Restoration Status

- `git -C ~/git/graphviz checkout lib/dotgen/dotsplines.c` -- restored clean.
- `git -C ~/git/graphviz status` -- dotsplines.c: nothing to commit,
  working tree clean.
- Clean `gvplugin_dot_layout` rebuilt and copied to `/tmp/gvplugins/`.
- Oracle SVG of `241_0.dot` from clean binary verified (no DIAG lines,
  valid SVG output).
- `tsc --noEmit` passes with zero errors.
- `git diff --name-only main` in graphviz-ts shows no `src/` file changed.
