# T5 — sfdp pipeline integration

## Context
gap-analysis.md §pipeline. The tail reuses mission 4-7 machinery:
ccomps + node_induce (pack), splineEdgesShifted (the C spline_edges
wrapper), packSubgraphs (l_node, CL_OFFSET, doSplines=true),
postprocess tail (bb + placeGraphLabel) as in neato/fdp.

## Task
- `src/layout/sfdp/init.ts`: sfdp_init_graph (EDGETYPE_LINE,
  neato_init_node semantics), makeMatrix + getSizes ports
  (@see neatogen/adjust.c:512,542 — ND_id assignment inside
  makeMatrix, agfstout head-seq order), getPos.
- `src/layout/sfdp/index.ts`: sfdp_layout — tuneControl,
  prism0 resolution (ctrl.overlap=0, initial_scaling=-4,
  pad from sepFactor), single-component vs ccomps branches,
  spline_edges per component BEFORE packSubgraphs, agdelete of
  component subgraphs, dotneato_postprocess equivalent; engine
  export SFDP_LAYOUT_ENGINE (src/index.ts import name).
- Rewrite sfdp.test.ts (D5: old tests encode the approximation) —
  C-derived unit tests incl. a full-precision oracle-parity fixture
  for sfdp-simple; sep-factor reuse; makeMatrix CSR fixture.
- All 5 sfdp goldens pass; full suite green vs mission baseline.

## Write-set
src/layout/sfdp/* (+ src/common/*, src/layout/pack/*,
src/layout/neato/* with journal entry).

## Commit
`feat(sfdp): port sfdp_layout pipeline — components, scaling, splines`
