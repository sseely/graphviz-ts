## Mechanism
1447's node ranks and in-rank ORDER are byte-identical to C at every one of
17 ranks (36 nodes) — mincross is fully conformant here. The divergence is
x-coordinate assignment only: multiple "diamond convergence" nodes (e.g.
`0x00400f41`, `0x00400f27`, `0x00400b8e`) land on a different (but
equal-cost) optimal x than C, the same x-coord network-simplex degenerate-
optimal-vertex-selection class already root-caused for share-b51's `blok_60`
([[b51-blok60-is-xcoord-ns-selection]] / [[2371-is-xcoord-ns-solution-selection]]).
Unlike blok_60 (whose divergence was fully explained by one shallow bug —
`classify.ts::labelVnode` using subgraph nodesep instead of root nodesep for
a cluster-scoped label vnode), 1447 has **no clusters and no edge labels**,
so that shallow fix cannot apply here. 1447 is therefore a clean repro of
the still-open, deeper mechanism from that note: the port's `Tree_edge`
list order (built by `feasibleTree`/`tightTree`'s edge-add traversal in
`ns-subtree.ts`/`ns-core.ts`) diverges from C's `tight_tree` in the
inter-tree-edge MERGE phase, so `lrBalance` (`ns-*.ts`, mirrors
`ns.c:LR_balance`) applies its degenerate-optimum reranking passes in a
different sequence and selects a different (equal-cost) optimal vertex for
several convergence nodes. The `splines=ortho` `@d` divergence (coord-count
mismatches on `0x00400b75->0x00400b8e` 8-vs-20 pts, `0x00400b8e->0x00400b68`
14-vs-20 pts, and the 192.39-max-delta `0x00400b06->0x00400b68`) is
downstream of these node-x shifts (ortho routing runs after position
assignment in the pipeline — `splines.ts::orthoDispatch` is called from
`dotSplines_`, which runs after `dotPosition`/`dotRank`/`dotMincross`), not
an independent maze corridor tie-break: every edge with a large coordinate
divergence touches at least one x-shifted node, most sharply `0x00400b8e`
(diff -15, opposite sign from its neighbors — itself a diamond-convergence
node with two direct real in-edges `0x00400b75->b8e` and `0x00400b86->b8e`,
same topology class as `0x00400f41`/`ca0`).

## Origin
- C reference: `~/git/graphviz/lib/dotgen/ns.c` — `LR_balance` (~line 778),
  walks `Tree_edge[i]` in list order for cutvalue-0 reranks; the list is
  populated by `tight_tree`'s edge-add traversal (`feasible_tree` /
  `tight_tree`, merge/`inter_tree_edge` phase).
- Port: `src/layout/dot/ns-subtree.ts` (`feasibleTree`/`tightTree`,
  inter-tree-edge search) and `src/layout/dot/ns-core.ts` (`Tree_edge` list
  / add-tree-edge), consumed by `lrBalance` in the port's `ns-*.ts` rank(2)
  pass (T4's territory — not instrumented here per task boundary).
- Downstream/consuming pipeline order confirmed read-only:
  `src/layout/dot/index.ts::dotLayoutPipeline` — `dotRank` → `dotMincross` →
  `dotPosition` (calls x-coord NS via `position.ts::createAuxEdges`) →
  `dotSplines_`/`orthoDispatch` (`src/layout/dot/splines.ts:421-470`). Node
  x is fully fixed before ortho routing begins.

## Causal chain
Tree_edge add-order differs (root-caused mechanism, not re-instrumented
here — see Ruled-out/Evidence below) → `lrBalance` reranks subtrees in a
different sequence → for nodes whose x-NS optimum is a degenerate interval
(convergence points where multiple omega-weighted in/out edges pull toward
the same total cost across a range of x), the port lands on a different
vertex of that interval than C → node centers shift (`0x00400f41`/`f27`
42px, `0x00400b8e` 15px, cascading 4-12px neighbors) while ranks/order stay
identical → `splines=ortho` routes from the (correct-order, wrong-x) node
boxes, so edges touching shifted nodes get different maze corridors,
producing the coordinate-count mismatches and the 192.39 max-delta edge.

## Ruled out
- **Mincross/order divergence**: ruled out by direct evidence — parsed both
  SVGs' node polygons, grouped by y (rank), sorted by x within each rank;
  all 17 rank-order lists are IDENTICAL C vs port (script + output captured
  below). Y-coordinates (ranks) are also identical for every one of the 36
  matched node titles (zero mismatches).
- **Bbox/translate artifact**: ruled out — the per-node coordinate parser
  reads raw polygon points (pre-translate), and the C/port SVGs use the
  same `translate(4,1192)` (ty delta 0.00 per the diagnostic tool); the
  per-node diffs are real geometry differences, not a global offset (they
  vary 0/4/8/12/42/-15 across nodes, not a constant).
- **The already-fixed labelVnode-nodesep bug** (the specific root cause
  found for blok_60): ruled out as applicable here — 1447 has zero
  `cluster` declarations and zero non-empty edge labels (`grep cluster\|
  label=\"[^\"]` on the corpus finds only one non-empty NODE label, not an
  edge label, and no clusters), so `classify.ts::labelVnode`'s cluster-
  nodesep code path is never exercised for this graph. This is why 1447
  still diverges despite that fix landing.
- **Independent ortho maze tie-break (2620-class) as the primary cause**:
  investigated via `-Godb=r` route dump
  (`GVBINDIR=/tmp/ghl dot -Godb=r -Tsvg 1447.dot -o /dev/null`); the dump
  has no per-edge labels so exact route-to-edge matching wasn't possible,
  but every edge with a large `@d`/coord-count divergence (b75->b8e,
  b8e->b68, b06->b68) is incident to a node with a confirmed x-shift — no
  divergent-shape edge was found between two x-unshifted nodes. Not fully
  excluded as a secondary contributor once node-x is fixed (would need
  re-diff after T4's fix), but it is not the primary/first mechanism.
- **A node-count/topology mismatch**: ruled out — both SVGs have exactly 36
  matched node titles with 1:1 correspondence.

## Evidence dump (per-rank order + x diffs, C vs port)
17 ranks, y = -1188 .. -36 step 72. Order IDENTICAL at every rank. Sample
(full list reproducible via the python parser below):
```
y=-324: [0x00400fc3, 0x00400cc5, 0x00400f41, 0x00400e0e]  (C order == port order)
y=-180: [0x0040107a, 0x00400d8c, 0x00400f27, 0x00400eb4]  (C order == port order)
```
x-diff (C_center - port_center), sorted by rank then x:
```
0x00400f41  y=-324  C=597.00 port=555.00  diff=42.00   <- convergence node
0x00400f27  y=-180  C=597.00 port=555.00  diff=42.00   <- convergence node
0x00400b8e  y=-900  C=95.00  port=110.00  diff=-15.00  <- convergence node (opposite sign)
0x00400ae6..0x00400ef8 (cascading chain)  diff 8..12 (monotone, non-anomalous)
0x00400b86/ba6/bfd/c23/c35/c5d/c6a/ca0/... diff 4..8   (small, monotone)
```

Repro (python, ad hoc, not committed):
```python
import re
def parse(path):
    txt = open(path).read()
    nodes = {}
    for m in re.finditer(r'<g id="node\d+" class="node">\s*<title>(.*?)</title>.*?<polygon[^/]*points="([^"]+)"', txt, re.S):
        pts = [tuple(map(float, p.split(','))) for p in m.group(2).strip().split(' ') if p]
        xs=[c[0] for c in pts]; ys=[c[1] for c in pts]
        nodes[m.group(1)] = (min(xs),max(xs),min(ys),max(ys))
    return nodes
# c = parse('/tmp/1447.c.svg'); p = parse('/tmp/1447.port.svg')
# group by rounded y-mid, sort by x-mid, compare order lists per rank.
```

## Aux-neighborhood dump for T4 (topology of the anomalous nodes, from DOT
source — real edges only, ranks in parens; rank step=72, rank(-324)=f41's
own rank)
```
0x00400f41 (rank -324): in  <- 0x00400c6a (rank -468, 2-rank edge, needs 1
                                virtual node at rank -396, real-virtual
                                omega weight per CLASSIFY_WEIGHT_TABLE[2][?])
                         in  <- 0x00400ca0 (rank -396, 1-rank DIRECT edge,
                                real-real omega weight 1)
                         out -> 0x00400f27 (rank -180, 2-rank edge, needs 1
                                virtual node at rank -252)
0x00400f27 (rank -180): in  <- 0x00400f41-chain virtual (rank -252)
                         in  <- 0x00400f1a (rank -252, 1-rank DIRECT edge,
                                real-real weight 1)
                         out -> 0x00400b68 (rank -36, 2-rank edge, needs 1
                                virtual node at rank -108)
0x00400b8e (rank -900): in  <- 0x00400b75 (rank -972, 1-rank DIRECT edge,
                                real-real weight 1)
                         in  <- 0x00400b86 (rank -972, 1-rank DIRECT edge,
                                real-real weight 1)
                         out -> 0x00400b68 (rank -36, multi-rank)
                         out -> 0x00400ba6 (rank -828, 1-rank DIRECT edge)
```
All three anomalous nodes (f41, f27, b8e) are two-real-in-edge (or
real+virtual-in) convergence points, structurally identical to blok_60's
`blok_59->blok_60->blok_61` pass-through pattern, just with an extra
incident edge (in-degree 2 rather than 1, due to the CFG diamond/branch-
merge shape of this radare2-CFG corpus graph) — still a degenerate-cost
configuration under the omega-weighted x-NS objective (verified the port's
`CLASSIFY_WEIGHT_TABLE = [[1,1,1],[1,2,2],[1,2,4]]` in
`src/layout/dot/classify.ts:71` matches C's `virtual_weight` table exactly,
so the weighting itself is faithful — the divergence is purely
add-order/tie-break, not a weight-table bug).

## Fix target
{ fixTarget: "src/layout/dot/ns-subtree.ts::feasibleTree/tightTree (inter-tree-edge merge-phase add-order) + src/layout/dot/ns-core.ts Tree_edge list, consumed by lrBalance",
  writeSet: [],
  sharedMechanismWith: ["path-structure-xns-residuals (T4: graphs-b51, 2475_2)", "2371-is-xcoord-ns-solution-selection"],
  expectedVerdictDelta: "1447: diverged -> structural-match (node-x fix); ortho @d coord-count residual may need re-check after fix, possibly tracked-deep (2620-class) if it doesn't fully resolve",
  classification: "hand-off-T4" }
```
