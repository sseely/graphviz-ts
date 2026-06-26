<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: selfRightSpace used label width unconditionally; C is flip-aware

- **Context**: fsm divergence cluster (`graphs-fsm` maxΔ7, `share-fsm`,
  `windows-fsm`), firstDiff `g[10]/path[1]/@d` (edge13 = LR_8->LR_6). Prompt
  framed it as edge-spline routing, but it was actually **node cross-position**:
  LR_4 (Δ7), LR_7 (Δ3), LR_8 (Δ3) landed at different in-rank coords; the edge
  splines just inherited the shifted endpoints.
- **Root cause**: `selfRightSpace` (src/common/splines-selfedge.ts:353) returned
  `SELF_EDGE_SIZE + lbl.dimen.x` unconditionally. C
  (lib/common/splines.c:selfRightSpace) uses the **rank-cross-axis** label
  dimension: `GD_flip(agraphof(aghead(e))) ? l->dimen.y : l->dimen.x`. For a
  flipped (rankdir=LR/RL) layout the self-edge label is rotated, so its HEIGHT
  (dimen.y), not its width, is the extra right-side space. fsm is `rankdir=LR`
  with self-loops LR_5->LR_5 ("S(a)") and LR_6->LR_6 ("S(b)"). The port added
  the wider dimen.x → LR_6's right-width over-grew → pushed LR_4 out by 7px;
  network-simplex re-balance then shifted LR_7/LR_8 by 3px.
- **Fix**: read `e.head.root.info.flip` (faithful to `GD_flip(agraphof(aghead(e)))`,
  flip is set on root in init.ts and propagated to subgraphs) and pick
  `flip ? dimen.y : dimen.x`. Empty-label still returns bare SELF_EDGE_SIZE.
- **Result**: all node positions + all 14 edge paths byte-match native (one
  arrowhead point off by 0.01 fp). Survey: **18 graphs** moved diverged→match
  (graphs/share/windows-fsm, graphs-NaN, *-b102, *-train11, graphs-ports,
  graphs-xx, 2193, ...), **0 regressions** (rules-gate PASS). All self-loop +
  labeled graphs under LR/RL were affected by the same bug.
- **Confidence**: High (native oracle byte-match + gate clean).
