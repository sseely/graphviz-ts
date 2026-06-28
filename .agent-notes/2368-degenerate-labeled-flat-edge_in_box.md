<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 2368 (maxΔ 5.0) blocked by degenerate labeled-flat label-emit + abomination edge_in_box frame — NOT a clean fix

- **Context**: 2368 (full version of 2368_1; concentrate, multi-rank, a big
  `rank=same {76 376 256 196 436 316}` band of opposing LABELED flat pairs).
  diverged maxΔ 5.0, firstDiff childCount. Port draws 6 edges, C draws 11.

- **The 5 "missing" port edges split two ways** (C output inspected):
  - **Non-degenerate** (`376->76 [to1]`, `196->376 [from2]`, `256->436 [to2]`):
    C draws PATH + label. The merged leg's representative is LABELED, so
    `findLabelNode` follows `to_virt` to a real label **vnode** → valid channel →
    routesplines succeeds.
  - **Degenerate** (`256->376 [to1]`, `376->256 [from1]`): C draws LABEL TEXT
    ONLY, no path. C-instrumented `make_flat_labeled_edge`: ln resolves to a real
    endpoint NODE (376, NORMAL), routesplines returns **pn=0**; but C set
    `ED_label->set=true` + `pos=ND_coord(ln)` BEFORE routing, so `edge_in_box`
    (label overlaps clip) still emits the label.

- **Why the current port misses all 5**: the 2368_1 fix added a `routeLoneEdge`
  skip (`sameRank && label && getMainEdge!==e → return`). Removing it + making
  `makeFlatLabeledEdge` return handled-on-degenerate (label set, no path) gets
  **2368 to 11 edges, 8/9 paths** (one non-degenerate path still missing — TODO)
  AND the 2 degenerate labels drawn.

- **The blocker (why reverted)**: doing that **regresses 2368_1** — its degenerate
  `256->376 [to1]` then draws the "to1" label, but C draws NOTHING there. Reason:
  2368_1 has `abomination` (single rank → flat-label rank inserted). C's
  `edge_in_box` tests `overlap_label` using the label pos in the **pre-translation
  internal frame**, where 2368_1's label falls OUTSIDE GD_bb/clip → not emitted.
  The port works in the FINAL (translated) frame, so its label pos is inside the
  visible area → a faithful `overlap_label` emit gate would still emit it. The
  port can't cheaply replicate C's pre-translate clip test.
  - So: 2368 (no abomination, label inside clip → draw) vs 2368_1 (abomination,
    label outside internal clip → don't) need OPPOSITE outcomes for the same
    degenerate-labeled-flat code path. The discriminator is the abomination
    coordinate frame + edge_in_box, same root as the hard cluster family.

- **C instrumentation recipe used** (reverted after): printf in
  `make_flat_labeled_edge` (ln name + `ND_node_type(ln)` + routed `pn`), gated on
  the 256/376 pair via strcmp; `make -C ~/git/graphviz/build gvplugin_dot_layout`;
  `sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl`; `LDBG=1 dot ...`.

- **Path to fix (future, multi-part, risky)**:
  1. Remove the `routeLoneEdge` labeled+merged skip.
  2. `makeFlatLabeledEdge`: return handled (true) on pn=0 with the label set
     (don't fall through). Add `label===undefined` guard to the non-adjacent
     corridor branch so labeled flats stay on the labeled path.
  3. Replace the emit gate (`label.set`) with a faithful `edge_in_box`
     (`overlap_label` vs graph clip) — AND make the abomination label pos land in
     the same relative frame C uses, so 2368_1's degenerate label falls outside
     clip. This frame reconciliation is the hard, unverified part.
  4. Find/fix the 1 missing non-degenerate path in 2368.

- **Decision**: reverted; left 2368 at maxΔ 5.0, 2368_1 byte-match preserved.
  2368's small delta is misleading — it is gated by the abomination/edge_in_box
  frame, the same deep interaction as the rest of the hard family.

- **Confidence**: High on the mechanism (C-instrumented). The fix needs the
  abomination-frame edge_in_box reconciliation, which is a larger effort.
