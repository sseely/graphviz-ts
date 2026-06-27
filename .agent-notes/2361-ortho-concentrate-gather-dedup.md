## Observation: splines=ortho has its OWN concentrate dedup (point-set), separate from class2 IGNORED

- **Context**: Fixing corpus 2361 (`splines=ortho; concentrate=true; rankdir=LR`),
  diverged — port drew 32 edge groups vs native 25 (7 extra = one leg of each of
  the 7 two-cycles).
- **Finding**: Under `splines=ortho`, edge concentration is NOT enforced by
  class2's `edge_type==IGNORED` (which the regular spline collector skips via
  `isSkippedOutEdge`). The ortho path (`ortho-adapter.ts dispatchOrthoEdges`)
  collected every non-self edge from `g.edges` with no dedup. C's `orthoEdges`
  (lib/ortho/ortho.c:1207-1228) has a **separate** mechanism: a point-set keyed
  by the unordered `(AGSEQ(tail), AGSEQ(head))` pair — first edge per pair routed,
  later edges sharing the pair skipped. Ported it into `buildEdges` (iterate
  nodes seq-order → outEdges agfstout-order, dedup `Set` on `(tail.id,head.id)`
  when `dotRoot(g).info.concentrate`).
- **Impact**: Fixes ALL ortho+concentrate graphs, not just 2361. class2's
  `conc_opp_flag` (double-arrowhead on the kept leg) was already correct and is
  orthogonal — the kept forward edge already rendered both arrowheads. 2361
  diverged→structural-match (maxΔ=0 positions; residual 144 = ortho maze
  channel fidelity, pre-existing, separate). 0 gate regressions.
- **Confidence**: High (oracle edge-set diff + C source pinned + gate).
