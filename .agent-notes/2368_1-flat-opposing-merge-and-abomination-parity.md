<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 2368_1 had THREE bugs (opposing-flat merge draw + abomination rank parity + empty group), NOT a concentrate bug

- **Context**: 2368_1 (`compound; concentrate; rank=same {76 376 256 196 316}`,
  flat edges incl. opposing pair `376->256 [invis]` / `256->376 [label=to1]`)
  listed as a "concentrate edge-case". It diverged (port drew an extra edge +
  wrong node spacing + a `routesplines illegal values` warning).

- **Finding (it is NOT concentrate)**: Removing `concentrate=true` reproduces the
  exact same C-vs-port divergence. Root causes are all in flat-edge handling:

  1. **Opposing-flat merge over-draw**. `flat_rev` (mincross) merges the cycle
     back-edge `256->376` into the existing `376->256` via `merge_oneway`
     (sets `to_virt`) and appends it to `ND_other`. C routes flat edges by
     gathering `flat_out`+`other` and grouping by `getmainedge`; the *labeled*
     merged edge has a label differing from its rep, so edgecmp's
     `ED_label(e0)!=ED_label(e1)` test puts it in its own 1-edge group →
     `make_flat_labeled_edge`, where the "label node" resolves through `to_virt`
     to the rep's **tail** (a real node, not a label vnode) → degenerate boxes →
     `routesplines` returns 0 points → **no spline, label never drawn**. The
     port's flat sweep (`routeDotEdges`→`routeLoneEdge`) routes each cgraph edge
     individually with no `getmainedge` grouping, so it drew `256->376`.
     - **Fix** (`edge-route.ts routeLoneEdge`): skip a flat edge when it is
       merged (`getMainEdge(e)!==e`) **AND has a label**. UNLABELED merged
       opposing edges (e.g. `flatedge.gv` `usmStats`<->`usmStats-5.5`, both
       visible) share the rep's null label, group with it, and
       `make_flat_edge`'s loop installs a spline on EVERY group member — C draws
       **both**, so they must NOT be skipped. Narrowing to labeled-only is the
       distinguishing rule.

  2. **abomination rank-index parity inverted** (the node-spacing bug; widths
     360 vs C 386). `make_LR_constraints` uses `sep[i&1]` when edge labels exist:
     real nodes on EVEN ranks get `nodesep` (18), odd ranks get 5. C's
     `abomination` inserts the flat-label rank at index **-1** (real nodes stay
     at even rank 0). This 0-based port instead shifts every `ND_rank` +1 (AD-2),
     so real nodes land on ODD rank 1 → `sep[1]=5` instead of 18.
     - **Fix**: `flat.ts abomination` records `g.info.abomShift += 1`;
       `position-aux.ts lrSep` uses `(rankIdx + abomShift) & 1` to recover C's
       parity. New field `GraphInfo.abomShift`. Only fires for graphs with a
       non-adjacent labeled flat edge on the lowest rank (rare), so inert for the
       goldens.

  3. **Empty edge `<g>` for the merged edge**. With (1) the merged `256->376`
     has no spline, but `edgeHasDrawableContent` (svg.ts) treated a merely
     *defined* `label` as drawable → emitted an empty `<g id="edge4">`. C's
     `edge_in_box` requires the label be *positioned* (`overlap_label` reads
     `pos`); the merged edge's label is never placed (`set` stays false).
     - **Fix**: gate the label on `i.label.set` (placed) not `!== undefined`.

- **Result**: 2368_1 diverged → byte-equivalent (node positions, both drawn
  splines, no empty group all match C modulo the port's comment/whitespace
  formatting). Path/edge/node group counts identical for 2368_1, flatedge, 121,
  241_1.

- **Confidence**: High — each root cause pinned to the C source and verified
  against the headless `/tmp/ghl` oracle; path/group counts byte-checked.

## Gotcha: a too-broad first fix regressed flatedge/121/241_1
Skipping ALL merged flat edges (`getMainEdge!==e`, no label gate) dropped one
leg of every VISIBLE opposing flat pair (childCount regressions on `flatedge`,
`121`, `241_1`, platform variants). The label gate is load-bearing: C draws both
legs of an unlabeled opposing pair.
