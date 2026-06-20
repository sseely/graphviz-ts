# T1 Findings: aux rank/chain dump harness + synthetic flat-back-port repro

## Canary Status

**GREEN** — forward `2:ne->3:nw`: port auxSize=7, C auxSize=7. Both agree.

## C-vs-Port auxSize/chain delta

| Edge | C auxSize | Port auxSize | Delta |
|------|-----------|--------------|-------|
| forward `2:ne->3:nw` | 7 | 7 | 0 (match) |
| reversed `3:sw->2:se` | 7 | 4 | **-3 (BUG)** |

Chain: empty on both sides (no virtual nodes in either C or port aux graph).
maxrank: 1 on both sides (2 ranks, no virtual node insertion).

## C-side raw dump (from native dot instrumentation)

C calls `make_flat_adj_edges` **once** with `cnt=2` (both edges grouped):

```
DIAG make_flat_adj_edges: edge0=2->3 maxrank=1 flip_g=0
DIAG   node 2: rank=0 type=0 order=0
DIAG   node 3: rank=1 type=0 order=0
DIAG after position: auxt=2 coord=(0.0,117.0) auxh=3 coord=(0.0,27.0)
DIAG after reposition: rightx=36.0 leftx=-36.0 midx=0.0 midy=0.0
DIAG   node 2 coord=(0.0,36.0)
DIAG   node 3 coord=(0.0,-36.0)
DIAG spline 2->3 size=7      <- clone of 2:ne->3:nw (forward)
DIAG spline 2->3 size=4      <- hvye weight=10000 (synthetic)
DIAG spline 3->2 size=7      <- clone of 3:sw->2:se (BACK EDGE in aux)
```

C aux graph (auxt=node2/rank 0, auxh=node3/rank 1):
- auxEdge1: auxt(2)->auxh(3), ports ne->nw, direction: FORWARD -> size=7
- auxEdge2: auxh(3)->auxt(2), ports sw->se, direction: BACK EDGE -> size=7
- hvye: auxt(2)->auxh(3), weight=10000, no ports -> size=4

## Port-side dump (from harness one-edge aux replay)

Port calls `makeFlatAdjEdges` **once per edge** (cnt=1).

For `3:sw->2:se`:
```json
{
  "edge": "3:sw->2:se",
  "maxrank": 1,
  "nodes": [
    { "name": "3(auxt)", "rank": 0, "type": "NORMAL", "order": 0 },
    { "name": "2(auxh)", "rank": 1, "type": "NORMAL", "order": 0 }
  ],
  "chain": [],
  "auxSize": 4
}
```

Port aux graph (auxt=node3/rank 0, auxh=node2/rank 1):
- auxEdge: auxt(3)->auxh(2), ports sw->se, direction: FORWARD -> size=4

For `2:ne->3:nw` (canary):
```json
{
  "edge": "2:ne->3:nw",
  "maxrank": 1,
  "nodes": [
    { "name": "2(auxt)", "rank": 0, "type": "NORMAL", "order": 0 },
    { "name": "3(auxh)", "rank": 1, "type": "NORMAL", "order": 0 }
  ],
  "chain": [],
  "auxSize": 7
}
```

## Root cause (one-line statement)

Port routes adjacent flat edges one-at-a-time (cnt=1); C groups all of
them into one aux call (cnt=N). With cnt=1 the reversed 3:sw->2:se clone
is a FORWARD edge in its own isolated aux graph and routes straight (size 4).
In C's joint cnt=2 aux, the same clone becomes a BACK edge (auxh->auxt,
rank 1->rank 0) and dot_splines_ routes it with a curl (size 7).

## Where the grouping gap lives

C (dotsplines.c:356-360):
```c
for (cnt = 1; l < LIST_SIZE(&edges); cnt++, l++) {
  if (le0 != (le1 = getmainedge((e1 = LIST_GET(&edges, l))))) break;
  if (ED_adjacent(e0)) continue; /* all flat adjacent edges at once */
```

The `continue` on `ED_adjacent(e0)` accumulates ALL adjacent flat edges
into one group. Port's `routeFaithfulSidePort` (edge-route.ts:296-298)
calls `makeFlatAdjEdges(g, [e], 1, ...)` -- single-element array, cnt=1.

## Minimal repro required

Two nodes (2, 3) on rank=same with a third anchor node (1) above both,
connected by 1->2 and 1->3 to fix their ranks, plus:
- 2:ne -> 3:nw (forward same-rank edge with compass ports)
- 3:sw -> 2:se (reversed same-rank edge with compass ports)

The anchor node is necessary; bare rank=same nodes without cross-rank edges
do not receive a stable rank assignment that triggers the aux path.

## Notes

- The rank=source subgraph difference (prime suspect per README) is NOT the
  direct cause of the curl gap. Both C and port assign auxt to rank 0
  naturally. The grouping gap is the real cause.
- C instrumentation was ephemeral: dotsplines.c restored clean.
  Plugin restored to /tmp/gvplugins (clean build).
- No virtual nodes appear in either C or port aux graphs for this repro.
  Chain is empty on both sides; auxSize is the only delta.
