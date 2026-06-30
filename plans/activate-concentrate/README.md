# Mission: activate `concentrate=true` (dead feature) + fix its latent bugs

Status: **MERGED to main (`274964e`, 2026-06-24).** Feature activated; ~10 latent
bugs fixed (activation, 5 crashes, parallel-edge merge, merged-chain routing).
Full survey: **0 verdict regressions, +1 conformant (b62)**. 2384 tests pass.

## Result per concentrate corpus graph (vs native dot)
- **b62**: diverged → **conformant**.
- **b71**: conformant (unchanged — its concentrate is a no-op).
- **b135**: node positions + edge count match C; stays diverged on other deltas.
- **b69**: all 47 nodes conformant C, edge count 137 = 137; stays diverged.
- **b15**: renders (was un-rendered / crash); 150 of 153 edges.

## FOLLOW-UP (return here) — the 2 still-diverged items: b69, b15

Both diverge **only** on merged-collinear edge *spline geometry*, not structure.
When `dot_concentrate` merges an edge's **entire** virtual chain (cascaded
`to_virt` redirects that shift rank), the port routes it as a **direct
tail→head segment**, while C routes the synthetic edge through the
representative chain's **box corridor** (`make_regular_edge` hackflag → boxes
from the merged nodes), producing a curved spline. So these few edges are drawn
but rougher than C → inflated maxDelta within `diverged` (b69 116→375, b15
25→195; nodes/counts match, so it is purely these splines).

- b69: 0 edges missing (137=137); the WAR-* collinear edges route direct.
- b15: 3 edges still unrouted — their chain resolution ends at a virtual node
  (the `chainSegments` to_virt walk cannot reconstruct the cascaded merge), so
  `routeMultiRankEdgeFaithful` bails (no crash, no spline).

**The fix** is the rank-walk: reconstruct the per-rank box chain through the
representative virtual nodes (as C's `make_regular_edge` does) instead of
following `to_virt` edges, so the merged-chain splines match C's corridor and
the 3 b15 edges route. Touches `chainSegments` / `routeChainSegmented`; regression
risk to the working non-concentrate path → full survey required. Repro:
`GVBINDIR=/tmp/gvplugins npx tsx test/corpus/render-one.ts
~/git/graphviz/tests/graphs/b69.gv dot` vs the C oracle; the affected edges are
WAR-WR1CD1/WR1VI1→MRS305-LOAD-WR1RP1, WAR-WRCALV1→MRS430-LOAD-WR1PP1,
WAR-WRSRV1→MRS405-LOAD-WR1PT1.

---

(original WIP plan retained below)

## How we got here

Troubleshooting the b69 "concentrate under-merge" divergence revealed that the
**`concentrate` graph attribute is never parsed** — `info.concentrate` /
`drawing.concentrate` are never assigned anywhere in `src/`, so `dot_concentrate`
(conc.ts, fully ported) and the class2 merge path **never run**. The entire
concentrate feature is dead code. b69 (concentrate=true) renders un-concentrated.

## The 4 bugs (chain surfaced by activating the feature)

1. **Flag unplumbed** — `concentrate` attr never read. **FIXED**: parse it in
   `dotGraphInit` (`mapbool`, mirroring `lib/common/input.c:708`); gate
   `dotConcentrate` on `g.info.concentrate` (was `g.info.drawing?.concentrate`,
   never set). conc.ts now runs.
2. **`concSlope` stub crash** — every path-args builder hardcoded
   `inEdges: [], outEdges: []` (edge-route-chain.ts, edge-route-faithful.ts,
   splines-flat.ts). Harmless while `merge` was always false; the first
   spline-merge (concentrator) node makes `setEndTheta` call
   `concSlope(n, [], [])` → `inEdges[0]` undefined → crash. **FIXED**: `concSlope`
   now reads the node's own `in`/`out` fast-edge lists directly, exactly as C
   `conc_slope` reads `ND_in(n)`/`ND_out(n)`; removed the dead inEdges/outEdges
   plumbing.
3. **Cluster + concentrate crashes (b15)** — **3 fixed, 1 open** (commit
   `55cfed4`). `b15.gv` (concentrate + nested clusters + records) exercised the
   never-run cluster `rebuild_vlists`. Fixed in order:
   - **3a** `dotScanRanks` hardcoded `minrank=0` (C computes the real min node
     rank) → `rebuild_vlists` walked ranks the cluster doesn't span → null rank
     leader → crash. **FIXED** (real min/max + min-rank leader).
   - **3b** `fillAllRankVlists` used `g.info.dotroot ?? g` (the cluster itself)
     as master rank table; C uses `dot_root(g)`. **FIXED** (`dotRoot(g)`).
   - **3c** `fillRankVlist` slices `rootRank.v` at the leader's order (baking the
     offset) but left a stale `vStart` → downstream `rankGet` double-offset →
     crash in `containNodesRank`. **FIXED** (`vStart = 0` after slice).
   - **3d OPEN** — b15 now clears concentrate + the whole position phase, then
     errors in **spline routing**: `concSlope` hits a `splineMerge` virtual node
     with **0 in-edges** (`inE.list[0]` undefined). C never produces such a node,
     so the port's cluster mergevirtual/rebuild leaves a merge node without an
     in-edge. This is the remaining b15 blocker. Lead: instrument which node
     (rank/cluster) and trace its in/out through `mergeVirtual`/`rebuildVlists`.
   b15 was `diverged` (maxDelta 25) on main; still errors, so the branch cannot
   merge until 3d is fixed.
4. **Merge under-count** — **OPEN.** Even after (1)+(2), the merge *decision*
   under-merges vs C: b69 140 vs 137 edges (the original 3 edges:
   `MRS380-LOAD-WRCLS1_TEMP->WRCLS1`, `WS-BATCH-DATE->MRS145-UPD-DATEFILE`,
   `MRS225-UPD-WR1MF1-WT->WAR-WR1MF1`); b135/b62 off by 1. Likely a
   `mergeable`/candidate-adjacency or mincross-ordering difference feeding
   `bothdowncandidates`/`bothupcandidates`. Needs oracle instrumentation of
   `dot_concentrate`'s candidate sweeps (C vs port) for these edges.

## Corpus impact (5 concentrate graphs)

| graph | main verdict | with WIP fix |
|---|---|---|
| b71  | conformant | **conformant** (concentrate now runs, correct) |
| b69  | diverged 116.69 | renders concentrated; under-merges 3 (Bug 4) |
| b135 | diverged 0 | under-merges 1 (Bug 4) |
| b62  | diverged 0 | under-merges 1 (Bug 4) |
| b15  | diverged 25 | **ERRORED (Bug 3 crash)** ← merge blocker |

Unit tests: 2384 pass with the WIP. Typecheck clean.

## To complete (next session)

1. Fix Bug 3 (cluster rebuild_vlists) — instrument `fillRankVlist`; compare
   `GD_rankleader`/order handling vs C `rebuild_vlists` for b15's clusters.
2. Fix Bug 4 (under-merge) — oracle-instrument the candidate sweeps for b69's 3
   edges; pin the predicate/ordering divergence.
3. Full corpus survey: require **0 regressions** (b15 back to ≥ diverged; b71
   stays conformant; b69/b135/b62 ideally improve). Then merge.

## Oracle recipe
`GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg <g>.gv` vs
`GVBINDIR=/tmp/gvplugins npx tsx test/corpus/render-one.ts <g>.gv dot`.
Edge-set diff (un-merged edges) + `conc.ts` merge instrumentation as in
`.agent-notes/b69-concentrate-undermerge.md`.
