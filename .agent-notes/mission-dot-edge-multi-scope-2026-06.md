# mission-dot-edge-multi — scope findings (2026-06-16)

## Observation: T1 (flat labeled edge) requires ranking-phase changes
- **Context**: Tracing the live path for `digraph{{rank=same a b} a->b[label="x"]}`
  before delegating T1.
- **Finding**: TS port creates NO flat label virtual node. After layout: 2 nodes,
  both rank 0, `ED_label.set=false`, pos (0,0); SVG = 2 texts (C = 3). The vnode
  `ln` that `make_flat_labeled_edge` reads via the `ED_to_virt` chain is created
  by `lib/dotgen/flat.c:flat_node` (`make_vn_slot(g, r-1, place)`), driven by the
  `flat_edges` preprocessing (flat.c:~295-330). `abomination()` (flat.c:187)
  inserts a whole rank when a flat labeled edge is at rank 0.
- **Impact**: T1's write-set (`splines-flat.ts` only) cannot create the vnode.
  Faithful T1 needs flat.ts/mincross/position changes. `abomination` rank
  insertion is golden-blast-radius — needs human sign-off / its own subtask.
- **Confidence**: High (model-state probe + C read).

## Observation: opposing-edge bug is install-on-wrong-orig, not grouping
- **Context**: Probing `digraph{a->b; b->a}` structure + geometry vs oracle.
- **Finding**: TS class2 merges the pair (b->a → `other_edge`, b.other=1; node a
  has 2 out-edges both resolving `getMainEdge=a->b`), so the cnt=2 group forms.
  But both shifted copies install via `resolveOrigEdge` onto the SAME orig a->b,
  so b->a gets no spline from the group and renders malformed. dot offsets both
  to x≈20 / x≈34 around center 27.
- **Impact**: Fixable in splines.ts (group→orig mapping) + splines-route.ts
  (install). No ranking-phase change needed — correctly scoped for T2/T3.
- **Confidence**: High (struct + geometry probe vs built dot 15.x).

## Observation: labeled-parallel crashes getMainEdge (virtual-chain gap)
- **Context**: Same probe on `digraph{a->b[label="1"]; a->b[label="2"]}`.
- **Finding**: `getMainEdge` walks `to_virt` into `undefined` (splines.ts:78).
  Labels themselves position correctly (4 texts match oracle); edge path wiggles
  where dot is straight. Router-side fix within T2/T3 write-set.
- **Confidence**: High (stack trace + geometry probe).
