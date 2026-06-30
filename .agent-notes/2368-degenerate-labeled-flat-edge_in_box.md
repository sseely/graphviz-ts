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

- **Decision**: reverted; left 2368 at maxΔ 5.0, 2368_1 conformant preserved.
  2368's small delta is misleading — it is gated by the abomination/edge_in_box
  frame, the same deep interaction as the rest of the hard family.

- **Confidence**: High on the mechanism (C-instrumented). The fix needs the
  abomination-frame edge_in_box reconciliation, which is a larger effort.

## UPDATE — root cause bottoms out at the x-NS ABSOLUTE ORIGIN (foundational)

Instrumented C `edge_in_box` (emit.c) + `map_edge` (postproc.c). Definitive:

- C `map_edge` early-returns when `ED_spl(e)==NULL`, so a degenerate (pn=0)
  labeled flat's label is NEVER translated — it stays at `ND_coord(ln)` in the
  PRE-translate internal frame. C `edge_in_box` then draws it iff that stale pos
  overlaps the final clip.
  - 2368_1 `256->376`: stale label x=**-119**, clip LL.x=-4 → outside → NOT drawn.
  - 2368   `256->376`/`376->256`: stale label x=**69**, clip UR.x=604 → inside → label-only drawn.
- The port's `mapEdge` ALREADY early-returns on `spl===undefined` (faithful), and
  splines run before `gvPostprocess` — yet the port's stale label lands at the
  FINAL node pos (2368_1: 27, on-canvas), not C's -119. Why: the port's x-coord
  network simplex picks a DIFFERENT ABSOLUTE ORIGIN than C. C's internal frame is
  uniformly shifted (node 376: C-internal -119 vs port-internal 27, Δ=146 = C's
  translate Offset); both reconcile to identical FINAL coords (all normal output
  conforms to), but the un-translated spline-less label exposes the origin gap.
  x-NS solutions are translation-invariant (only relative positions are pinned),
  so C and the port legitimately choose different absolute origins (NS
  spanning-tree root). node-box conformant proves the RELATIVE layout is correct.

- **Therefore 2368 cannot be conformant without reproducing C's x-NS absolute
  origin** (its NS tree-root choice) so spline-less labels land in C's frame.
  That is a foundational change to x-coord assignment affecting every graph — far
  beyond a targeted fix — and the origin is itself an arbitrary (if
  deterministic) NS choice. The 3 NON-degenerate missing legs (`376->76`,
  `196->376`, `256->436`) ARE routable, but the 2 degenerate legs are blocked,
  so 2368 stays diverged regardless.

- **Options for the future**: (a) allowlist 2368 as an accepted x-NS-origin /
  untranslated-spline-less-label artifact (relative geometry correct; a C frame
  quirk); (b) a foundational effort to match C's x-NS absolute origin; (c) a
  partial fix routing only the 3 non-degenerate legs (reduces but does not
  eliminate the divergence; needs a full corpus survey for regressions). NOT
  landed — reverted to clean state (skip retained; 2368_1 + 1624 conformant).

- **C-instrument recipe (emit/postproc)**: printf in `edge_in_box` (emit.c,
  label pos + clip) gated by strcmp on the pair; `make -C ~/git/graphviz/build
  dot` (relinks libcommon); EDBG=1. Revert + rebuild after.

## UPDATE 2 — the origin gap is the x-NETWORK-SIMPLEX ABSOLUTE ANCHOR (pivot order)

Instrumented C `set_xcoords` to dump every node's x-aux NS rank (=ND_coord.x)
for 2368_1, vs the port (XORG probe before gvPostprocess):

| node | C xrank | port xrank | diff |
|------|--------:|-----------:|-----:|
| 376  |   -119  |     27     | 146  |
| 196  |    -29  |    117     | 146  |
| 256  |     43  |    189     | 146  |
| 316  |    115  |    261     | 146  |
| 76   |    205  |    351     | 146  |

PERFECTLY UNIFORM +146 shift (2368: +228). The RELATIVE solution is identical
(conformant final); only the absolute anchor differs. Facts:
- x-coords come from `rank(g, 2, …)` (NS balance=2 = LR_balance, which does NOT
  `scan_and_normalize` — so coords are left un-normalized and CAN be negative).
  The port's `rank2Balance` matches C exactly (balance 2 → lrBalance, no
  normalize). `set_xcoords` = `coord.x = ND_rank(v)` in BOTH (no normalize). So
  it's purely the NS-produced absolute value.
- `init_rank` is conformant (BFS from priority-0, longest-path) and produces
  NON-negative ranks. The negative anchor (-119, -120 slack) emerges from the
  simplex iterations + `LR_balance` reranks, whose subtree shifts depend on the
  NS pivot order (nlist + in/out edge-list iteration driving
  leave_edge/enter_edge). C's pivot sequence anchors 146 lower than the port's.
- C's x-aux graph also has SLACK (type 2) + VIRTUAL (type 1) nodes interleaved;
  C's leftmost is a slack at -120 (left of real 376 at -119). bb.LL is from real
  nodes only (376 left-edge -146 in C, 0 in port).

**Foundational fix = bit-exact replication of C's x-NS pivot order** so the port
lands on C's absolute anchor. Because the shift is uniform, an equivalent is to
translate the port's whole internal x-frame by the (graph-specific) shift BEFORE
gvPostprocess — final coords stay identical (bb.LL shifts too), and the
untranslated degenerate labels then land in C's frame. BUT the shift amount
(146/228) is an emergent NS property the port cannot derive without reproducing
C's pivot sequence. This is a large, fragile change with blast radius over all
490 conformant graphs (every graph's internal x-frame), for the reward of a few
degenerate-label edge cases — the relative layout is already perfect.

**Status**: foundational root cause fully isolated (instrumented end to end);
NOT landed. The fix is a dedicated NS-pivot-replication project (instrument both
NS pivot sequences, find the nlist/edge-order divergence, align, full survey per
iteration), not a single-session change. Recommend allowlisting 2368 unless/until
that project is undertaken.
