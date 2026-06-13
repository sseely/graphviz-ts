# Mission 2 — osage gap analysis (T1 recon, 2026-06-10)

Baseline at mission start: 978 passed / 44 failed (unchanged from
baseline-after-m1.md). All 6 osage goldens fail.

## Reference geometry decoded (osage-simple)

- Node cells: 54x36; array-cell gap 4pt; cluster bb expands content by
  margin/2 = 2pt each side → cluster 116x80 for 3 nodes in 2 cols.
- Root level: clusters packed side by side with 4pt gap, no root
  margin (depth 0 → margin 0); canvas pad 4pt → 244x88.
- osage-labels: cluster grows by PAD'd label height (16.5+8 = 24.5pt
  border at TOP) → 104.5 tall; label text centered in border strip.
- osage-empty-cluster: empty labelled cluster = label dimen (36.75 x
  16.5) + margin 2 each side + TOP border 24.5 → 40.75 x 45, centered
  vertically in its array cell.
- osage-sortv: sortv values are IGNORED by C unless packmode=array_u
  (PK_USER_VALS); ref confirms input-order grid. The test fails only
  because of margins.

## Root causes (ordered by leverage)

| # | Cause | Affects | Fix site |
|---|---|---|---|
| G1 | `GvcContext.layout()` calls `engine.cleanup()` BEFORE render; C runs gvFreeLayout after gvRenderJobs. osageCleanup clears `info.clust/n_cluster`, so renderClusters sees nothing → no cluster polygons at all | all 6 | src/gvc/context.ts, src/index.ts (shared-code push-forward, journal) |
| G2 | osage `DFLT_MARGIN = 8`; C uses 4 (neatogen/adjust.h via osageinit.c) → every gap/margin doubled (96 vs 88 trio) | all 6 | src/layout/osage/index.ts |
| G3 | `mkClusters` never calls do_graph_label; C builds cluster labels + GD_border there → no label, no border space | labels, empty-cluster, nested | src/layout/osage/index.ts (reuse doGraphLabel from layout/dot/graph-label.ts) |
| G4 | osage never runs place_graph_label (C: dotneato_postprocess) → label pos/set never filled, renderClusterLabel skips | labels, empty-cluster, nested | src/layout/osage/index.ts (reuse placeGraphLabel from layout/dot/position-bbox.ts) |
| G5 | pack attr readers are stubs: getPackModeInfo reads `g.info.packMode` (never set) instead of the `packmode` GRAPH ATTR; getPack reads `g.info.pack`; parsePackModeInfo lacks C's `array(_flags)(N)` / `aspect F` syntax → PK_USER_VALS/COL_MAJOR/aligns unreachable | array-mode (latently), any packmode user | src/layout/pack/index.ts (+types) — allowed write-set, journal |
| G6 | osage pushes sortv vals as 0 instead of late_int(child, sortv); cattr/vattr root-declaration check missing | none today (needs array_u) — port per spec | src/layout/osage/index.ts |

Non-gaps verified: array-pack.ts faithfully ports arrayRects (cell
maxima, prefix sums, centering, area-sort with stable ties); array
packer sort for equal-size cells matches ref input order; emit's
renderClusters/renderClusterLabel already correct (dot-cluster passes).

## Fix order

T2 (G1) → T3 (G2+G6) → T4 (G3+G4) → T5 (G5) → T6 verify/merge.
T2 first because nothing cluster-related is even visible until the
pipeline stops destroying layout state before render.

## Risk notes

- T2 changes shared pipeline order for EVERY engine; the 11 dot
  goldens and full suite are the canary (dotCleanup is non-destructive
  for render state, so dot should be unaffected).
- T5 makes `pack`/`packmode` attrs live for neato/fdp/twopi component
  packing; no current golden input sets them except osage-array-mode
  (which matches the default anyway), so expect no cross-engine diffs.
