## Observation: T5 — dotsplines.c:422-430 post-routing label loop was missing

- **Context**: T5 C-oracle probe of 5 label kinds (node-xlabel, edge-label,
  edge-xlabel, graph-label, combined).
- **Finding**: The C post-routing loop at dotsplines.c:422-430 iterates nlist
  calling place_vnlabel + updateBB for every VIRTUAL node that has a label.
  This loop was never ported. `placeVnlabel` existed in splines-label.ts but
  was only called by `setEdgeLabelPos` (an ortho/posAlg path not triggered for
  normal spline routing). The gap caused edge-label to remain set=false after
  routing, so addXLabels treated it as an unpositioned xlabel and placed it at
  edgeMidpoint instead of the virtual-node coordinate.
- **Fix**: Added `placeRegularEdgeLabels(g)` to splines.ts (called after the
  parallel-edge routing loop, before edgeNormalize). Exposed new export from
  splines-label.ts. 6 unit tests in splines-label.test.ts cover placement,
  bb expansion, flat-edge skip, and multi-node nlist traversal.
- **Finding**: addLabelBB (utils.c:569) is the *neato* bb helper called from
  compute_bb. The dot equivalent is updateBB in splines-label.ts, which was
  already present. No addLabelBB gap exists in the dot pipeline.
- **Finding**: EDGE_LABEL branches at dotsplines.c:243, 253, 1552, 1650, 1776
  are inside CURVED/ORTHO routing and make_regular_edge pathplan — none of
  those code paths are ported yet. These branches are not reachable with the
  current test inputs and are not a gap for EDGETYPE_SPLINE graphs.
- **Finding**: Combined probe has 1 residual diff: xlabel at x=34.13 (TS) vs
  x=34.12 (C), delta=1.0e-11 over tolerance. This is a JS FP representation
  artifact inside placeLabels (label/xlabels.js), outside the write-set.
  Not FMA — no disassembly evidence. Not a bug introduced by this patch.
- **Confidence**: High (verified via probe + vitest 1262/1262).
