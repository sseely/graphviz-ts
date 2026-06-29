<!-- SPDX-License-Identifier: EPL-2.0 -->
# x-coord NS call chain (where the divergence lives)

```mermaid
graph TD
  dotPosition["dotPosition (position.ts)"] --> createAux["createAuxEdges"]
  createAux --> rank["rank / rank2 (ns.ts, balance=2)"]
  rank --> feas["feasibleTree (ns-subtree.ts)"]
  feas --> findTight["findTightSubtree / interTreeEdgeSearch / stExtractMin"]
  findTight --> addTE["addTreeEdge (ns-core.ts) — builds Tree_edge LIST"]
  rank --> loop["rank2Loop (pivots: leaveEdge/enterEdge/exchangeTreeEdges)"]
  rank --> lrb["lrBalance (ns.ts) — walks Tree_edge[i] in ORDER"]
  lrb --> enter["enterEdge → dfsEnterOutedge (slack/2 rerank)"]
  addTE -. "LIST ORDER drives" .-> lrb

  classDef bug fill:#fdd,stroke:#c00;
  class addTE,findTight bug;
```

**Red = fix surface.** The base optimum and lim numbering match C; the
`Tree_edge` list ORDER (set by `addTreeEdge` call sequence during the subtree
merge) does not, so `lrBalance` reranks degenerate edges in a different order and
selects a different optimal vertex. Fix the merge order so `addTreeEdge` fires in
C's sequence.
