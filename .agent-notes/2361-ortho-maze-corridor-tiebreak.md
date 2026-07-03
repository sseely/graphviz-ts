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

## F1 follow-up: maze-CONSTRUCTION order fixed (faithful), but it is NOT the
## mechanism — 2361/2620 residual is still OPEN

- **Context**: F1 tasked "make the port's maze/sgraph CONSTRUCTION ORDER
  conformant to C" per the "snode index / adjacency-insertion order" theory
  above. Found and fixed a real, independent faithfulness bug on the way, but
  it does not close the residual — root cause remains unidentified.
- **Real bug found and fixed**: `partition.ts`'s `monotonateTrapezoids`
  (the free-space decomposition feeding `mkMaze`'s cell array) was an
  iterative reachability walk that (a) started at `tr[trStart].u0`/`d0`
  instead of `trStart` itself (C's actual `traverse_polygon` entry — C visits
  `tr_start` FIRST, `from` is only used for branch logic, not as the first
  node to visit) and (b) always pushed children in fixed `u0,u1,d0,d1` order
  regardless of `from`/`dir`, whereas C's `traverse_polygon` (partition.c:
  400-621) has a ~10-way branch table that reorders u0/u1/d0/d1 recursion
  based on `from`/`dir`/geometric `equal_to` cusp checks. The prior port's
  comment justified this as box-SET-correct (decomp geometry depends only on
  trap geometry/flip, never on the monotone-chain state) but explicitly
  flagged the ORDER as not C-faithful. Replaced with an explicit-stack DFS
  (stack-safe per [[triangulation-recursion-stack-overflow]]) that transcribes
  the full branch table (`PartitionHelper.childOrder`, exported for test as
  `traverseChildOrderForTest`) and pushes children in REVERSE call order so
  LIFO pop reproduces C's exact preorder sequence.
- **Empirically DISPROVEN as the 2361/2620 mechanism**: A/B tested the fix
  via a clean, isolated script (`partition()` called directly, no debug
  scattered in the render pipeline) on 5 geometries — f2pair, f3branch, a
  synthetic 2×2 grid, and **2361's own exact real maze geometry** (gcells +
  BB extracted from a live `mkMaze` call) — old (HEAD) vs new (fixed)
  `partition()` output is **byte-identical order**, not just identical set,
  on every one. Full render (`render-one.ts`) of 2361 and 2620 is
  **byte-identical SVG** before/after the fix. A 17-file sweep of every
  `splines=ortho` corpus graph (14, 1408, 1447, 1447_1, 144_ortho, 1658,
  1856, 1990, 2361, 2183, 2538, 1880, 2082, 2168_5, 56, 2620, 2643) is
  byte-identical before/after. **Ruled out**: maze/sgraph *construction*
  order (traverse_polygon → createSEdge insertion → snode adjEdgeList) as
  the driver of the AC->IW / FF->IV / `pensiondk->auditlog_logmessage`
  (2620, Δ3207) ties. Likely explanation (not yet verified): partition()'s
  output is a pure axis-aligned rectangle decomposition of rectangle
  obstacles, whose trapezoid adjacency graph is typically a simple/mostly-
  linear chain — most neighbours are already `visited` by the time a
  different push order would reach them, so branch-order rarely changes the
  actual box sequence for this problem class. The OLD entry-point bug
  (skip `trStart`) also turns out to be moot in practice: `trStart` is by
  definition a triangular/cusp trapezoid (`inside_polygon`'s check), which
  never satisfies the rectangle box-emission criterion in the fixtures
  tested.
- **2620 caveat**: 2620 also has ~19 edges with `COORD-COUNT` mismatches
  (different point-count entirely, "Issue-2 signature") and ~10+ NODES with
  898pt deltas — i.e. node-position-level divergence unrelated to ortho
  routing at all. Δ3207 on `pensiondk->auditlog_logmessage` is the only item
  in scope for this mission; the rest is out of scope (separate defect
  class, do not chase here).
- **Kept the fix anyway**: zero regressions (full `npm run test`: 204/204
  files, 2588/2588 tests incl. 11 new branch-table unit tests; `tsc
  --noEmit` clean; 17/17 ortho corpus byte-identical), and it corrects a
  documented C-fidelity gap per CLAUDE.md ("do not simplify algorithms") —
  independently valuable even though it doesn't move this residual.
- **Still open**: what actually drives AC->IW/FF->IV/pensiondk's tie. Not yet
  instrumented: (a) EDGE ROUTING order — `es` sort via `gvQsort(es,
  edgeCmp)` in `ortho/index.ts:139`, and whether `updateWts`'s
  channel-congestion weight mutation (applied per-edge as `convertSPtoRoute`
  runs) biases a later edge's Dijkstra choice differently port vs C, even
  though the *maze* is order-invariant; (b) whether C's true chosen route
  costs genuinely tie (the "equal cost by construction" claim above was
  never verified against a real cost dump — `sgraph.c`'s `#ifdef DEBUG`
  process/new/adjust prints are not compiled into the default C build; would
  need `-DDEBUG` on `sgraph.c` specifically, not done here per "do not edit
  C source" — a rebuild flag would be a legitimate next step, not a source
  edit). Do NOT re-attempt the maze-construction-order fix again; it is
  proven neutral by direct evidence, not by absence of testing.
- **Confidence**: High on what was ruled out (direct empirical A/B, 5
  geometries + 17-file corpus sweep + real 2361 geometry reproduction).
  Low/unknown on the actual mechanism — genuinely open.
