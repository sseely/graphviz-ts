<!-- SPDX-License-Identifier: EPL-2.0 -->
# 2796 NS-inputs verification (T1, fix/2796-cluster-ranking)

Method: env-gated `DUMP2796` dumps at `rank2` entry (per-call constraint
graph: every GD_nlist node + out-edge with minlen/weight) and at
`make_aux_edge` (creation-ordered, tagged with the constructing function),
mirrored C↔TS, diffed line-wise after virtual-name normalization. C tree +
TS dumps reverted; oracle stdout byte-verified (its exit 1 +
`trouble in init_rank` + `lost 3 16 edge` stderr is its normal state).

## Verdict

```json
{
  "inputs": "match (ranking) / diverge (x-coord aux, 2 pinned sites)",
  "evidence": "45 rank2 calls; calls 0-43 (43 cluster rankings + root rank) LINE-IDENTICAL (2923 constraint edges total). Call 44 (x-coord aux graph, balance=2, N=1362) differs in ~10 weight=0 cluster-wall edges. C's aux graph is CYCLIC (init_rank scans 1271/1362, 91 unscanned -> 'trouble in init_rank' recovery state); the port's is ACYCLIC (1362/1362).",
  "mechanism": {
    "cause": "Port computes different lengths (and one different emission position) for a handful of cluster left/right-wall aux edges",
    "origin": "src/layout/dot/position-cluster.ts:makeLrvn (two V->V wall edges: C len=26 & 24.8, TS 18 & 18) and :keepoutOthernodes (one V->V wall edge: C len=26 emitted after the 16.4 edge, TS len=24.8 emitted before) — C refs lib/dotgen/position.c:make_lrvn, :keepout_othernodes (392-416)",
    "causalChain": "The differing wall-edge lengths/positions change the x-aux constraint graph; C's version happens to close a directed cycle (the acknowledged upstream bug: aux-edge construction can create cycles, draft MR !4849) -> C's init_rank fails and lays out from the recovery state (overlapping clusters, later a triangulation failure loses edge 3->16). The port's version is acyclic -> clean x-solve -> the measured whole-layout divergence.",
    "ruledOut": [
      "cluster-ranking constraint inputs (calls 0-43 line-identical)",
      "ranking algorithm/NS core (identical inputs, both sides proceed; C rank calls succeed too)",
      "collect/leader structure (same node counts, same call structure, same aux-edge totals per site: 318/130/565/1400/491)",
      "edge_pairs + LR sets (only sub-ULP FP-print deltas: 5x len 30.2 vs 30.200000000000003 in make_LR_constraints — flagged below)"
    ]
  },
  "fixLocus": ["src/layout/dot/position-cluster.ts (makeLrvn, keepoutOthernodes)"]
}
```

## Notes

- **Deliberately NOT fixed** (user decision, D1): making these wall edges
  C-exact would reproduce C's aux-graph cycle and its acknowledged-broken
  recovery layout (upstream xfail #2796; draft MR !4849 rewrites exactly
  this construction). The port's output meets every expectation in the
  upstream issue (0 overlapping cluster pairs vs C's 5; all edges routed).
- The wall-edge length deltas smell like margin/half-width inputs
  (26 = 8+18, 24.8 = 8+16.8, 18 = nodesep or 8+10?) — the follow-up
  mission should determine WHICH side computes the faithful value and
  whether the port's variant mislays any graph whose oracle is clean.
- **FP-noise class (flagged, unfixed):** make_LR_constraints emits 5 aux
  lens of 30.200000000000003 vs C's 30.2 (sub-ULP summation-order noise);
  harmless here but an int-truncation downstream could flip on other
  inputs someday.
- Port's `initRank` lacks C's `ctr != N_nodes` diagnostic (silent on
  cyclic inputs). Behaviorally equivalent (unscanned nodes keep their
  ranks either way); the missing diagnostic is noted, not a defect.
- Related diverged corpus items mapped in
  `plans/fix-2796-cluster-ranking/related-diverged-items.md`.
