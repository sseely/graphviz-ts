## Observation: 2361 maxΔ=144 residual is an ortho maze shortest-path corridor TIE-BREAK, not a cost bug

- **Context**: After the concentrate dedup fix, 2361 is structural-match with
  maxΔ=144 (edge `AC->IW`) + 110 (`FF->IV`). Investigated the residual.
- **Finding** (instrumented both sides):
  - Node boxes are **conformant** port vs C (all 14, all 4 edges) → the maze
    cell partition, cell weights, MARGIN(36), and cost constants
    (delta=1, mu=500, BIG=16384) are identical.
  - Routing order matches C: fixed a real faithfulness bug first — port `edgeLen`
    used `bb.LL` corners; C (`ortho.c:1124`) uses node CENTERS (`ND_coord`,
    `DIST2`). After the fix the port's `d` values are exact-equal to C's
    (`AC->IW`: 90²+158²=33064 ✓). `AC->IW`'s length is unique (no tie); the only
    length ties (PF→FF/PG→GF; AC→FS/AC→FW) are in a far region. So routing order
    is NOT the cause. **The edgeLen fix changed 0 verdicts** (kept as a
    faithfulness correction).
  - C maze route (`-Godb=r`, DEBUG already on in ortho.c:24): `AC->IW` =
    `H@y486 → V@x302` (horizontal-first L). Port maze route: `V@x291 → H@y396`
    (vertical-first L). Both are **1-bend L-routes** of **equal Manhattan length**
    between the same diagonal pair. `FF->IV`: both V-H-V (2 bends, same middle
    track H@72) but different vertical columns.
  - Cost model + fPQ + relax are all faithful (`fpq.ts` ≡ `fPQ.c`; relax `<`
    keeps first path on ties). Since cells are identical, port and C compute the
    SAME cost for any given route → the two chosen routes must be **exactly equal
    cost**, and the divergence is the **tie-break**: which equal-cost corridor
    the Dijkstra exploration reaches first.
- **Impact**: The residual is governed by sgraph **snode index / adjacency-insertion
  order** from maze cell construction (the order cells/sides are created and
  `createSEdge` populates `adjEdgeList`), feeding the heap structure. This is the
  known 2620-class "ortho routing @d" residual — a deep, fragile area. Fixing it
  means making snode indexing + adjacency order conformant to C's maze build,
  with regression risk across all ortho graphs. Out of scope for the concentrate
  mission; structural-match is the accepted bar. NOT a cost/algorithm bug.
- **Confidence**: High (maze input identical + C route dump + faithful fPQ/relax
  ⇒ equal-cost tie by construction).

## Repro
```
DOT=~/git/graphviz/build/cmd/dot/dot
GVBINDIR=/tmp/ghl $DOT -Godb=r -Tsvg ~/git/graphviz/tests/2361.dot -o /dev/null 2>/tmp/odb.txt
# route blocks (newpath..stroke) in sorted route_list order; #14=AC->IW, #10=FF->IV
```
