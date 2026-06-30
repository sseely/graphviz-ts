# Mission 4 — twopi gap analysis (T1 recon, 2026-06-10)

Baseline at mission start: 990 passed / 32 failed (matches
baseline-after-m3.md). 6 twopi goldens + 1 unit test fail.

## Per-test findings

- **twopi-star / twopi-tree / twopi-root-attr** (`g[3][childCount]`
  1 vs 2): node ellipses/text are conformant to the refs; the
  edge groups are missing their `<path>` elements. Root cause: C
  twopi_init_graph calls `setEdgeType(g, EDGETYPE_LINE)`; our
  twopiInitGraph never sets the edge-type nibble in g.info.flags, so
  neato splineEdges() sees EDGETYPE_NONE and returns without routing.
  (Same latent gap exists in neatoLayout — out of scope here, noted
  for mission 6.)
- **twopi-ranksep** (height 181 vs 318): ranksep=2.0 ignored — output
  radius is the DEF_RANKSEP=1.0 ring (144pt diameter + 36 node + 1).
  getRankseps port exists in circle.ts; the attr read or parse loop
  diverges. Expected: ranks[i] cumulative sums of colon-separated
  deltas, min-clamped (MIN_RANKSEP), last delta repeated.
- **twopi-chain** (cy -306 vs -18): chain A-B-C-D-E should center at
  C with 2 rings (height ~4*72+36 = 324 in ref; ellipse[1] cy -18 =
  bottom row). Ours puts the first ellipse at -306 — root selection
  or theta/parent assignment diverges. Read C findCenterNode /
  setParentNodes / setChildPositions against circle.ts.
- **twopi-disconnected** (height 248 vs 227): two 3-node components;
  C packs with getPackInfo(g, l_node, CL_OFFSET=8) — node-geometry
  polygon packing; our buildPackInfo downgrades Node mode to Graph
  (bb) packing. Either port node-mode packing (putRects returns null
  for Node today) or verify whether polyRects bb-packing constants
  explain the 21pt delta.
- **unit test hub-at-origin**: asserts the hub lands at ~(0,0) in
  inches BEFORE final translation. Evaluate per D5 after the chain
  fix; the star ref hub is at the canvas center, consistent with
  pos (0,0) pre-translation, so the test likely encodes C behavior.

## Fix order

T2 setEdgeType (3 tests) → T3 ranksep → T4 chain placement (+ unit
test) → T5 disconnected packing → T6 verify/re-baseline/merge.
