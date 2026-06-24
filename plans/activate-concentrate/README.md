# Mission: activate `concentrate=true` (dead feature) + fix its latent bugs

Status: **WIP on `feature/activate-concentrate` (87b4e97) — 2 of 4 bugs fixed; NOT
merged (b15 regresses).**

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
3. **Cluster + concentrate crash (b15)** — **OPEN.** `b15.gv` (concentrate +
   subgraph clusters + record nodes) throws `Cannot read properties of null`
   at `conc.ts:259 fillRankVlist` (the cluster `rebuild_vlists` path:
   `rootRank.v[lead.info.order]`). The cluster vlist-rebuild has never run.
   **This is the merge blocker** — b15 was `diverged` (maxDelta 25) on main and
   now errors (a regression), so the branch cannot merge until this is fixed.
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
| b71  | byte-match | **byte-match** (concentrate now runs, correct) |
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
   stays byte-match; b69/b135/b62 ideally improve). Then merge.

## Oracle recipe
`GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg <g>.gv` vs
`GVBINDIR=/tmp/gvplugins npx tsx test/corpus/render-one.ts <g>.gv dot`.
Edge-set diff (un-merged edges) + `conc.ts` merge instrumentation as in
`.agent-notes/b69-concentrate-undermerge.md`.
