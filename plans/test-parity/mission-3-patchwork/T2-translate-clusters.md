# T2 — Translate cluster bbs with the drawing

## Context
See gap-analysis.md: the ONLY divergence in all 6 patchwork goldens is
that cluster bbs stay in centered tree coordinates; C's
dotneato_postprocess → translate_bb shifts them (and label positions)
along with the nodes by -root_bb.LL.

## Task
1. src/layout/pack/index.ts shiftOneGraph: after shifting nodes, also
   (a) shift g.info.bb when set, (b) shift the graph label pos when
   `set`, (c) recurse into g.info.clust — port of
   lib/pack/pack.c:shiftGraph layered onto the existing node loop.
   Keep normalizeGraphBB's final root-bb recompute for its other
   callers (twopi/circo).
2. src/layout/patchwork/index.ts: replace normalizeGraphBB(g) with a
   translateDrawing(g) helper: dx/dy = -g.info.bb.ll (root bb from
   walkTree), call shiftOneGraph(g, dx, dy)
   (@see lib/common/postproc.c:translate_drawing, translate_bb).

## Acceptance criteria
- All 6 patchwork goldens PASS
- Full suite: failure count ≤ 38; no previously passing test fails;
  11 dot goldens green

## Write-set
src/layout/patchwork/index.ts, src/layout/pack/index.ts (journal)

## Commit
`fix(patchwork): translate cluster bbs with the drawing per C translate_bb`
