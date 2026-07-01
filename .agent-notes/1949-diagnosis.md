# 1949 diagnosis (2026-06-30)

## Observation: 1949 divergence is NOT the compound-edge MR
- **Context**: Corpus 1949.dot diverges (parity.json maxDelta 90.68,
  firstDiff `svg/g[1]/g[8]/polyline[1]/@stroke`). Upstream MR that "fixes
  #1949" is `89e1d18a4 dotgen makeCompoundEdge` (compound.c) — removes two
  over-strict asserts (`bez->sflag`/`bez->eflag`) by guarding on
  `!inBoxf(...)`.
- **Finding**: The port ALREADY has that fix. `src/layout/dot/compound.ts`
  `applyHeadClip` guards `sflag && !inBoxf(sp)`; `applyTailClip` guards
  `eflag && !inBoxf(ep)` — matches fixed C `compound.c:323/384`. Port does
  not assert/crash. The MR only prevented a native assertion the port never
  had.
- **Impact**: 1949's actual divergence has two unrelated causes below.
- **Confidence**: High.

## Observation: D1 — HTML-like label text runs are not entity-decoded
- **Context**: The +18.7px x-shift (native width 651 vs port 670) is NOT
  cluster/compound code. Chased it: only the `structC->structParty` rank-3
  edge-label vnode is fat (ht=33.80 vs a normal virtual's 1), padding the
  rank2↔4 spacing on BOTH sides via pht[3]. That label is
  `structC->structParty[label=<&#91;el...>]`.
- **Finding**: The label vnode ht = its `dimen.x` (flip). `sizeTextContent`
  measures the RAW entity string `&#91;el...` (9-10 chars → w=33.80) instead
  of the decoded `[el...` (6 chars → w≈14.8). The port's HTML parser
  (`src/common/htmltable-parse.ts`, text item built at ~line 200
  `items.push({ text: t.value, ... })`) never decodes XML/HTML entities in
  text runs. C decodes via expat during tokenization (htmllex.c), so native
  measures `[el...`. Plain-string labels DO decode (make-label.ts
  htmlEntityUTF8), which is why `label="[el..."` matches but `label=<...>`
  diverges.
- **Minimal repro**: `digraph{rankdir=LR; A->B[label=<&#91;el...>
  fontsize=8 fontname=Arial]}` → native 167x44, port 186x48 (+18.7w/+4h).
  Plain `label="[el..."` → both 167x44.
- **Impact**: Primary defect (drives maxDelta 90.68 via the whole-graph
  shift). Fix: decode entities in HTML text tokens (mirror C expat /
  reuse `htmlEntityUTF8`) so both sizing and emit see `[el...`. Emit then
  produces literal `[` (matches native) instead of re-passing `&#91;`.
  Caution: decode once; `&amp;/&lt;/&gt;` must round-trip through emit
  re-escaping; watch the expat `]`→`&#93;` guard (`protect_rsqb`).
- **Confidence**: High — root cause proven by dump + minimal repro.

## Observation: D1+D2 fixed; residual = separate pre-existing y-shift
- **Context**: After fixing D1 (entity decode) + D2 (pen-color inherit),
  re-surveyed 1949.
- **Finding**: All X coords now match native exactly (width 651=651);
  structParty cell border is `stroke="red"` (2 red = native). 1949 maxDelta
  fell 90.68 → ~2.97. Full survey gate PASS, 0 regressions across 789.
  Remaining: a UNIFORM +2.97px y-offset (graph 279 vs native 282 tall) —
  every element same size, only shifted. Localized to clusterAuto's label
  order-axis (LR) placement sitting 2.97 low → cluster top short. This
  PRE-EXISTED both fixes (original port was also 279 tall) and is a distinct
  cluster-label-flip divergence, NOT part of D1/D2.
- **Impact**: 1949 stays `diverged` (not byte-match) on the 2.97 residual;
  follow-up = LR cluster-label order-axis placement (position-ycoords
  adjustRanks / borderTop-bottom for flip). Separate mission.
- **Confidence**: High.

## Observation: D2 — HTML cell border color not inheriting node pen color
- **Context**: structParty node `color="red"`, HTML-table label with
  `<TD BORDER="1" SIDES="B">Party</TD>`.
- **Finding**: The cell's bottom border polyline is `stroke="red"` in
  native, `stroke="black"` in port. Port `src/common/htmltable-emit.ts:162`
  `doBorder({... color: d.color ?? 'black' ...})` hardcodes black fallback;
  native inherits the current pen color (node color=red). Same `?? 'black'`
  / missing-inherit pattern at lines 181, 324.
- **Impact**: Secondary defect (the firstDiff @stroke). Verify against
  `~/git/graphviz/lib/common/htmltable.c` emit_html_* to confirm the
  inherited source (node pencolor vs table color).
- **Confidence**: High on symptom+locus; C behavior to confirm.
