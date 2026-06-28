<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 1902 — subgraph edge-endpoint must dedup member nodes

- **Context**: 1902 diverged (childCount: port drew a1->a3 TWICE). Input:
  `subgraph cluster { subgraph cluster { a1->a2 a3 } b1 b2->a1 } -> a3`.
- **Finding**: a `subgraph {…} -> a3` edge expands to one edge per member node.
  The port's resolveEndpoint collected member names via NameCollector, which
  lists a name once PER textual occurrence — a1 appears in both `a1->a2` and
  `b2->a1`, so a1 was resolved twice → a1->a3 emitted twice. cgraph walks the
  subgraph's node DICTIONARY (each node once).
- **Fix**: dedup the resolved member nodes by node id in resolveEndpoint
  (builder.ts) before the AGSEQ sort. Edge set now matches native exactly.
  0 regressions (graphs-world's `37->{...}` has no dup names → inert).
- **RESIDUAL (1902 still diverged)**: removing the phantom edge UNMASKED a deep
  nested-cluster ranking/x-coord divergence — node positions differ (a1/a2/a3
  x off ~64; b1 x=215 vs 43; b2 on a DIFFERENT RANK, y=-258 vs -114). maxΔ
  64->172 reflects this real layout gap, previously hidden by the extra edge.
  This is cluster ranking/positioning for nested clusters + a subgraph->node
  edge (nslimit1=0), NOT spline routing — a separate deep effort.
- **Confidence**: High (dedup) — edges byte-match native, 0 corpus regressions.
