# structural-match bucket: text-position (minus label family)

22 ids confirmed against `test/corpus/parity.json` (`verdict=structural-match`,
maxDelta/maxDeltaPath recorded below per sub-cluster). Oracle SVGs read from
`/var/folders/f_/f2qfy7gj5mg3w6nh3csypddr0000gn/T/dot-corpus-oracle/3a26f7da8c36/`;
port SVGs rendered via
`GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts <path> dot`.

| sub-cluster | ids | count | family | tractability | ref |
|---|---|---:|---|---|---|
| html-cell-align | graphs-inv_inv, graphs-inv_nul, graphs-inv_val, graphs-nul_inv, graphs-nul_nul, graphs-nul_val, graphs-val_inv, graphs-val_nul, graphs-val_val, 1898, graphs-html2, linux.x86-html2_dot, nshare-html2_dot | 13 | html-label | known-mechanism | html-nested-table-and-port-gap.md (residual); new: htmltable-pos.ts:205-209, htmltable-pos-runs.ts:221-240 |
| self-loop-label-widen | graphs-sr_box_dbl, graphs-sr_circle_dbl | 2 | self-loop-label | known-mechanism | new: splines-selfedge.ts:189-231 vs lib/common/splines.c:1036-1046 |
| nojustify-space | graphs-nojustify | 1 | nojustify | known-mechanism | new: make-label.ts:131 vs lib/common/shapes.c:2132-2145 |
| edge-port-label-clip | graphs-arrowsize, 144_ortho | 2 | other-named (edge-port-label-clip) | needs-C-instrumentation | new: splines-label.ts:168-192 (headEndpoints/tailEndpoints) + splines-clip.ts arrow-clip stash |
| cluster-labeljust | 2592 | 1 | other-named (cluster-labeljust-not-inherited) | known-mechanism | new: graph-label.ts:23-26 vs postproc.ts:288-297 |
| a4-oracle-triangulation | 2470, 2471 | 2 | A4-oracle | accepted-portability | known-divergences.md#a4-oracle-in-an-acknowledged-broken-state-the-init_rank--pathplan-family (2471 formally accepted; 2470 same family, not yet entered — gap) |
| shape-none-image-labelloc | 2082 | 1 | NOVEL | needs-C-instrumentation | new finding, no existing ref |

Total: 13+2+1+2+1+2+1 = 22.

---

## html-cell-align (13 ids)

**Mechanism**: `placeCellRuns` (`src/common/htmltable-pos.ts:194-210`) calls
`centerContentBox(cbox, w, h)` (`htmltable-pos.ts:167-174`) **unconditionally**
for every TD's text content — it never reads `cell.align`/`cell.valign`. The
image branch (`alignImageBox`, `htmltable-pos.ts:242-253`) *does* honor
`cell.align === 'left'/'right'`, but the equivalent branch is simply absent
for text. Separately, `placeSimpleRuns` (`htmltable-pos-runs.ts:221-240`)
hardcodes `centerX - run.width/2` for every line, never reading the per-line
`brAlign` captured by the parser (`htmltable-parse.ts:144`, `applyBrTag`) for
`<BR ALIGN="LEFT"/RIGHT">`. Both are the same class of defect: alignment
attributes are parsed but dropped before layout, defaulting to CENTER. C's
`pos_html_cell` (`lib/common/htmltable.c:1487-1500+`, text branch) explicitly
branches `HALIGN_LEFT` (`cbox.UR.x -= delx`, flush left, no centering) /
`HALIGN_RIGHT` / default-center; `HALIGN_TEXT` (BR-driven per-line justify)
is excluded from that shrink entirely and handled per-line in
`emit_htextspans`.

**Evidence**: the 9-graph matrix (`graphs/{inv,nul,val}_{inv,nul,val}.gv`) all
share one literal HTML fragment (only the two `<TD ALIGN="left">` text
strings differ per test). Rendering `nul_nul.gv`: oracle
`text[1]/@x=16, text[2]/@x=16` (both rows flush left, same column); port
`text[1]/@x=41.83, text[2]/@x=16` — only the *narrower* row shifts, by
exactly half the width difference between the two rows' own natural widths
(centering artifact). `1898.dot`'s HTML table top-label reproduces the same
signature (`text[4]/@x`: oracle 63, port 265.56 — the narrower "llllll" cell
shifted). `html2.gv` additionally exercises `ALIGN="right"`/`VALIGN="bottom"`
on ROWSPAN/COLSPAN cells (the "two"/"4" cells, y/x deltas 20.1/30.56) *and*
the BR-justify case (`c`'s `<BR ALIGN="LEFT"/RIGHT">` multiline label: oracle
lines at x=313.54/313.54/341.93 — left/left/right; port at
313.54/327.74/327.74 — all silently centered). `linux.x86-html2_dot` /
`nshare-html2_dot` are byte-identical mirrors of `html2.gv`; their
maxDeltaPath (`@transform[2].param[1]`) is a downstream artifact — the wrong
cell/line heights change the drawing's total height, shifting the root `<g>`
translate — not a distinct mechanism.

**Ruled out**: font-metric/measurer divergence (the Helvetica-Bold LUT
fallback-to-Times warning is a red herring — `font_name_equal_permissive` in
C *also* rejects "Helvetica-Bold" against "helvetica" due to trailing
letters, so both sides fall back to Times identically; confirmed no `<B>`
tag is present so `bold` stays false on both sides for width purposes).
Ruled out node/table sizing (`buildColX`/`buildRowY`, `htmltable-pos.ts:302-315`)
— column widths themselves match; only the per-cell/per-line *placement
within* the already-correct column width is wrong.

---

## self-loop-label-widen (2 ids: graphs-sr_box_dbl, graphs-sr_circle_dbl)

**Mechanism**: `rightLoop`/`leftLoop`/`topLoop`/`bottomLoop`
(`src/common/splines-selfedge.ts:189-231`) accumulate a **fixed** per-iteration
`stepx`/`stepy` each pass (`dx += stepx`). C's `selfRight`/`selfLeft` (and
symmetric top/bottom) additionally grow the axis **after computing each
loop's label position**: `lib/common/splines.c:1045-1046` —
`if (width > stepx) dx += width - stepx;` (mirrored for `dy`/`stepy` in the
vertical variants) — so when a self-loop's *own* label is wider than the
fixed step, the next parallel loop is pushed out far enough to clear it. The
port never performs this label-driven growth in any of the four loop
functions.

**Evidence**: every node in `sr_box_dbl.gv`/`sr_circle_dbl.gv` has exactly
two identical self-loops with a long label (`"tailport=X headport=Y"`,
~130-140pt at 14pt Times). Extracting every self-loop label's `@x` (or `@y`)
across all 15 node pairs: the **first** loop of every pair is byte-identical
between port and oracle (e.g. node35 `x=142` both sides); the **second**
loop diverges by a near-constant ~100-135pt in every single pair (node35:
oracle 275.59 vs port 160, Δ=115.59, exactly the recorded maxDelta). This
rules out a per-node/per-position bug and isolates the defect to the
iteration-2-onward step size.

**Ruled out**: `groupSize`/`dispatchEdgeGroup` (`src/layout/dot/splines-groups.ts`)
edge-count fragmentation — the active b15/edgecmp-grouping mission
hypothesized a similar-shaped defect for concentrate chains, but it does
**not** apply here: if `cnt` were wrongly fragmented to 1 per self-loop, both
loops would receive *identical* geometry (same `i=0` computation twice); the
observed loop-2 position is a distinct, `i=1`-consistent value, just missing
the label-width top-up. Ruled out arrow-clip-length divergence — self-loop
label offsets, not node clip geometry, and the *first* loop's identical
position with node bbox rules out a font/geometry-table mismatch on this
class of edges.

---

## nojustify-space (1 id: graphs-nojustify)

**Mechanism**: `TextlabelT.space` is set once at label creation
(`src/common/make-label.ts:131`, `space: {x: w, y: h}` = the label's own
natural dimensions) and is **never updated** after the node's final box size
is resolved. `renderLabel` (`src/common/poly-gencode.ts:180-182`) uses
`label.space.x` to offset `\l`/`\r`-justified lines from the label center —
faithfully mirroring C's `emit_label` (`lib/common/labels.c:255-266`,
`p.x = lp->pos.x - lp->space.x/2.0` for `'l'`). But C's `poly_init`
(`lib/common/shapes.c:2132-2145`) *recomputes* `ND_label(n)->space.x` once
the node's actual box width (`bb.x`, from `width=`/minimum-size resolution)
is known: `space.x = max(dimen.x, bb.x) - spacex` for box shapes, unless
`nojustify=true`, in which case it stays `dimen.x` (record shapes have the
equivalent `resize_reclbl`, `shapes.c:3547-3562`, gated by the same
`nojustify_p`). The port has no equivalent post-resize step anywhere.

**Evidence**: node `n` (`width=3`, default `nojustify=false`, label
`"aaaaaaaaaaaaaa\nddd\l"`) is the *only* text diff in the whole file: line 1
("aaaaaaaaaaaaaa", `'n'`-justified/centered) matches exactly; line 2
("ddd", `\l`-terminated) is oracle `x=8` (flush against the node's true
216pt-wide box) vs port `x=64.5` (offset from the label's own — too narrow —
natural width). Every *other* node/label in the file matches exactly: `m`
(`width=3, nojustify=true`) takes C's `else` branch (`space.x=dimen.x`, same
as the port's frozen behavior — coincidental match); `b` (`nojustify=true`,
no width override) and the two record-shape nodes `l`/`p` (no `width=`
override, or `nojustify=true`) have no widening delta to expose the bug.

**Ruled out**: text measurement — line 1 (same label, same font) matches
byte-for-byte; only the justified line's offset is wrong, isolating the
defect to `space.x`, not glyph widths.

---

## edge-port-label-clip (2 ids: graphs-arrowsize, 144_ortho)

**Mechanism (partially instrumented)**: `place_portlabel`
(`lib/common/splines.c`, ported as `placePortlabel`/`applyPortlabelPos`,
`src/layout/dot/splines-label.ts:219-290`) anchors head/tail port labels
(`labelangle`/`labeldistance` + `headlabel`/`taillabel`) at `pe` — the
spline's *clipped* endpoint after arrowhead clipping
(`headEndpoints`/`tailEndpoints`, `splines-label.ts:168-192`, reading
`bez.eflag`/`bez.ep` set by the arrow-clip pipeline in
`src/common/splines-clip.ts`). The label offset (`writePortlabelPos`,
`splines-label.ts:276-290`) is correct arithmetic (`PORT_LABEL_DISTANCE *
distMult`, angle from `pe`→`pf`), but its *anchor point* differs from C for
a specific subset of arrow shapes.

**Evidence**: `graphs/arrowsize.gv` fans 17 edges `Z->{A..Q}` (same
`arrowsize=4`, one distinct `arrowhead=` per edge) with all-matching node
positions (confirmed via `<ellipse cx/cy>` diff — zero differences across
all 40+ nodes). Only the label `@x`/`@y` for `Z->{B,C,D,E,M,N,O,P,Q}`
diverge (`normal, inv, dot, odot, odiamond, box, obox, tee, crow` — all
single-primitive arrow shapes); `Z->{A,F,G,H,I,J,K,L}` match exactly
(`none, invdot, invodot, open, halfopen, empty, invempty, diamond` —
compound/no-op shapes). `144_ortho.dot` cross-validates: `arrowtail=inv`
(the more-divergent tail label, Δ=34.6, matches the recorded maxDelta) vs
`arrowhead=vee` (smaller divergence, Δ≈12) on the *same* edge — consistent
with an arrow-shape-keyed clip-point error rather than a labelangle/distance
formula bug.

**Ruled out**: node ranking/position (exact match confirmed); the
label-distance/angle arithmetic itself (matches C's formula verbatim,
confirmed by reading `writePortlabelPos` against `splines.c:place_portlabel`
line-for-line); general HTML/nojustify/self-loop families (plain node
labels here, no HTML, no BR/`\l` justify, no self-loops).
**Not yet ruled out / needs next step**: the exact arrow-clip stash call
site in `splines-clip.ts` that produces `bez.ep`/`bez.eflag` for each named
arrow shape — `arrows.c` itself is marked fully ported
(arrowhead-geometry-done.md), so the gap is most likely in *when*/*whether*
`stashArrow` is called for single- vs compound-shape clips, not the
per-shape length table. Requires adding temporary tracing to
`SplineClipHelper.arrowEndClip`/`stashArrow` for `normal`/`inv`/`dot` vs
`invdot`/`diamond` to isolate the exact branch.

---

## cluster-labeljust (1 id: 2592)

**Mechanism**: `readLabelPos` (`src/layout/dot/graph-label.ts:23-26`) —
the function that computes a **cluster's** `label_pos` bitmask — reads only
`labelloc` (`'b'` → 0 / else → 1 = TOP). It never reads `labeljust` to OR in
`LABEL_AT_LEFT`(2)/`LABEL_AT_RIGHT`(4). The root-graph equivalent,
`rootLabelPos` (`src/common/postproc.ts:288-297`), *does* read `labeljust`
correctly. The consumer, `placeLabelNonFlip`/`placeLabelFlip`
(`src/layout/dot/position-bbox.ts:174-199`), is a faithful, fully-correct
port of C's `place_graph_label` — it already branches on bits 2/4 when
present. The defect is entirely upstream, in the producer that never sets
those bits for clusters.

**Evidence**: `2592.dot` sets `graph [labeljust=l, ...]` at the top level —
in cgraph semantics this becomes the *default* inherited by every
subsequently-created subgraph (including `cluster_b1`/`cluster_b2`) that
doesn't set its own `labeljust`. Both clusters' HTML `<B>B1</B>`/`<B>B2</B>`
labels: oracle `@x=8` (flush against the cluster's left edge, matching
`LABEL_AT_LEFT`); port `@x=394.97` (dead center of the cluster box,
`(bb.ll.x+bb.ur.x)/2` — the fallback branch in `placeLabelNonFlip` when
neither bit 2 nor 4 is set). Delta 386.97 matches the recorded maxDelta
exactly.

**Ruled out**: text measurement (2-char bold labels render identically in
size, only position differs); html-cell-align family (this is a
graph/cluster-level label routed through `doGraphLabel`/`placeLabelNonFlip`,
not `placeCellRuns`/`placeSimpleRuns` — a structurally different code path).

---

## a4-oracle-triangulation (2 ids: 2470, 2471)

**Mechanism**: both are "trouble in init_rank" triangulation-recovery
degenerate cases where the C oracle itself operates from an acknowledged
broken/infeasible recovery state (upstream GitLab xfail, same family as
#2796). `2471` is a **formally accepted** divergence — confirmed present in
`test/corpus/accepted-divergences.json` (`match.id=2471`, `class=A4`,
`verdict=structural-match`, "ranking + x-aux constraint inputs verified
line-identical... residual numeric deltas are NS behavior from the
infeasible/cyclic recovery state — not chased"). `2470` is the **same
upstream family** — confirmed via `git -C ~/git/graphviz log --all --grep`:
commit `1f75a131e` ("add another triangulation failure test case",
Gitlab #2470) adds `tests/2470.dot` with
`test_regression.py::test_2470` marked
`xfail(reason="https://gitlab.com/graphviz/graphviz/-/issues/2470")` and
docstring `"another 'trouble in init_rank variant'"` — the identical
phrasing/mechanism as `test_2471`'s xfail entry (added in the same commit
range, `strict=True`).

**Ruled out**: this is *not* independently re-diagnosed at the layout level
(would require porting the same multi-session A4-oracle investigation
described in `.agent-notes/graphs-b15-collect-design.md`-adjacent history);
attribution rests on the upstream xfail provenance match, which is
sufficient for classification but not a full mechanism replay for 2470.

**Gap**: `2470` is not yet in `test/corpus/accepted-divergences.json` — this
diagnosis recommends adding a `match.id=2470` entry mirroring 2471's, once a
maintainer confirms the same "6-lost-edges / line-identical rank2 inputs"
verification has been done for 2470 specifically (this diagnosis did not
re-run that verification for 2470 due to file size — 22918 lines — and
time budget; only the upstream-provenance match was confirmed).

---

## shape-none-image-labelloc (1 id: 2082) — NOVEL

**Mechanism**: not yet fully isolated. `2082.dot` uses `shape=none
fixedsize=true height=1.9 labelloc=b` nodes with an `image=` attribute
pointing at a path that does not exist on this machine
(`/Users/srajagopalan/.pyenv/.../elastic-load-balancing.png` etc.) — the
image fails to load on **both** port and oracle (confirmed: no `<image>`
element differences; node `<polygon>`/bbox geometry is absent since
`shape=none`, and all node positions otherwise match — this is `splines=ortho`
but node coordinates are unaffected, unlike `144_ortho`). Every `labelloc=b`
node label (`lb`, `worker1..5`, `events`) is shifted in **Y only** by an
exact constant **60.6pt**, regardless of the node's absolute position in the
layout (`-411.5→-472.1`, `-220.7→-281.3`, `-29.9→-90.5`, all Δ=60.6). No
`@x` differs anywhere in the file.

**Ruled out**: html-label (plain node labels, no HTML markup here);
nojustify (`\l`/`\r` line justification — labels here are single-word, no
multiline justify markers); self-loop-label (no self-loops in this graph);
edge-port-label-clip (no `headlabel`/`taillabel`/`labelangle`/`labeldistance`
attrs present); general node/rank positioning (node `x` coordinates and
inter-node spacing match exactly — only the label's *own* vertical offset
within its fixed-height, `shape=none` node differs, and by a perfectly
uniform constant, ruling out any position- or content-dependent layout
divergence).

**Needs next step**: instrument the `shape=none`/missing-image vertical
label-placement arithmetic — likely in `src/common/poly-sizing.ts`
(`expandForShape`/`labelValign`) or the image-fallback sizing path
(`src/common/htmltable.ts:196` area references `gvusershape_size` returning
`(-1,-1)` on failure for HTML images; the plain-node equivalent for
`shape=none` + `image=` needs to be located and compared against C's
`poly_init` image/label vertical composition when `gvusershape_size` fails).
The uniform 60.6pt constant strongly suggests a single fixed miscalculation
(e.g., a wrong default image height substituted for the failed load, or an
extra/missing margin term) rather than a scaling error.

---

text-other: 22 cases → 7 sub-clusters; 21 attributed, 1 novel;
top candidate = html-label (13)
