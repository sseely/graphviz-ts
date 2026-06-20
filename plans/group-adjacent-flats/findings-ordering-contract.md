# T1 Findings: Ordering Contract — Adjacent Flat Group #241_0

## C Instrumentation Dump (2026-06-20)

Native binary: dot 15.0.0; instrumented `make_flat_adj_edges` in
`lib/dotgen/dotsplines.c`; rebuilt `gvplugin_dot_layout` only (NOT libgvc);
plugin copied to `/tmp/gvplugins/`; C source restored clean after capture.

### 2-3 group (the only cnt>1 group in #241_0)

```
T1DIAG make_flat_adj_edges: e0_tail=2 e0_head=3 cnt=3
T1DIAG   edges[0]: 3->2 tail_port_def=1 head_port_def=1 seq=2
T1DIAG   edges[1]: 2->3 tail_port_def=1 head_port_def=1 seq=2
T1DIAG   edges[2]: 2->3 tail_port_def=1 head_port_def=1 seq=2
T1DIAG   auxt cloned from: 2
T1DIAG   auxh cloned from: 3
T1DIAG   aux_spline: 2->3 size=7
T1DIAG   aux_spline: 2->3 size=4
T1DIAG   aux_spline: 2->3 size=4
T1DIAG   aux_spline: 3->2 size=7
```

All three edges share main-edge AGSEQ=2 (same equivalence class).

### Other groups (all cnt=1)

All other flat-adj groups in #241_0 are single-edge and not relevant.

---

## AD-1 Resolution: e0 vs edges[0]

The prior diagnosis dump was NOT inconsistent. `make_flat_adj_edges` takes a
SEPARATE `e0` parameter (normalized-forward first edge) distinct from `edges[]`:

    static int make_flat_adj_edges(graph_t *g, edge_t **edges, unsigned cnt,
                                   edge_t *e0, int et)

In `make_flat_edge` (the caller): `e0 = *edges`, then if BWDEDGE, normalized
via `makefwdedge` before being passed as `e0`.

For the 2-3 group:
- `edges[0]` = `3->2` (back edge, first by edgecmp portcmp tiebreak: sw<ne)
- `e0` passed in = normalized-forward `2->3` (3->2 was BWDEDGE, flipped)
- `tn = agtail(e0) = node2`, `hn = aghead(e0) = node3`
- `auxt = cloneNode(subg, tn)` = clone of node2 (rank 0, left)
- `auxh = cloneNode(auxg, hn)` = clone of node3 (rank 1, right)

Per-edge clone direction (agtail(e) == tn check):
- edges[0]: 3->2 -> agtail=3 != tn=2 -> cloneEdge(auxg, auxh, auxt) = BACK -> size=7 CURL
- edges[1]: 2->3 -> agtail=2 == tn=2 -> cloneEdge(auxg, auxt, auxh) = fwd -> size=7
- edges[2]: 2->3 -> agtail=2 == tn=2 -> cloneEdge(auxg, auxt, auxh) = fwd -> size=4

edges0IsForward = false (edges[0] is the BACK edge 3->2).
e0IsForward = true (e0 is normalized forward; determines auxt frame, not edges[0]).

---

## Port AGSEQ Analog

`Edge.seq` (src/model/edge.ts line 44) -- monotone sequence number assigned at
construction (`Edge._nextSeq++`). Direct equivalent of `AGSEQ(e)` in C.

However, for the 2-3 group all three edges share the same main-edge seq in the
AGSEQ(getmainedge(e)) tiebreak -- seq does NOT separate 3->2 from 2->3 here.
The tiebreak that puts 3->2 first is portcmp: sw < ne alphabetically.

---

## Port Comparator for T2

The fix does NOT need to reproduce C's exact edgecmp sort order within the
group. It only needs `edges[0].tail === lowerRankNode` before calling
`buildFlatAux`. The simplest implementation:

    After collecting the group keyed by unordered {u,v}, ensure edges[0].tail
    is the lower-rank (left) node. Concretely: scan the group, find any edge
    with tail === lowerRankNode, swap it to position 0.

This mirrors C's `makefwdedge(e0)` normalization that always yields tn=lowerRankNode.

portSeqField: "Edge.seq"
portSortComparator: "swap any edge with tail===lowerRankNode to position 0"

---

## Interface Contract (for T2)

pair: "2-3"
cnt: 3
edges0IsForward: false
e0IsForward: true
auxtSourceNode: "2"
auxhSourceNode: "3"
portSeqField: "Edge.seq"
portSortComparator: "ensure edges[0].tail===lowerRankNode before buildFlatAux"

edgesOrdered:
- [0] tail=3 head=2 portsDefined=true seq=2 auxDir=back auxSize=7
- [1] tail=2 head=3 portsDefined=true seq=2 auxDir=fwd  auxSize=7
- [2] tail=2 head=3 portsDefined=false seq=2 auxDir=fwd  auxSize=4

---

## Oracle SVG -- edge12 (3:sw->2:se)

C oracle (clean binary, 2026-06-20):
  d="M228.98,-10.86C227.99,-9.87 229.12,-8.7 227.98,-7.88 216.52,0.37 206.01,1.79 195.86,-3.95"
  7 coord-pairs, Y-range = 12.65pt (curl)

Port (current / buggy):
  d="M227.98,-2.98C217.82,-2.98 207.66,-2.98 197.49,-2.98"
  4 coord-pairs, Y-range = 0pt (straight line)

After T2: port must emit 7-point curl with Y-range > 10pt.

---

## C Restoration Verification

- git -C ~/git/graphviz checkout lib/dotgen/dotsplines.c -- restored.
- git -C ~/git/graphviz status -- nothing to commit, working tree clean.
- Clean gvplugin_dot_layout rebuilt and copied to /tmp/gvplugins/.
- GVBINDIR=/tmp/gvplugins dot -Tsvg tests/241_0.dot emits 0 T1DIAG lines.
- npx tsc --noEmit in graphviz-ts -- exit 0.
