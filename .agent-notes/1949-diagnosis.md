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

## Observation: fix-1949-flat-aux Batch-1 diagnosis — cause is NOT rank=source; it is OUT of splines-flat.ts scope (STOP)
- **Context** (2026-07-01): Post orientation-fix (480b34a) the current 1949
  state is native **651×282** vs port **651×315** (+33 height; the 2.97 note
  above is STALE — 480b34a moved height 279→315). Symptom = README's:
  structParty:S↔structDefaultAuto flat compass-port pair routes wrong.
  Instrumented C `make_flat_adj_edges` (DBG1949 fprintf, clean plugin rebuild)
  and the port `makeFlatAdjEdges` (DBG1949 console.error), diffed field-by-field.
- **Mechanism (first divergence = `cnt` / edge grouping)**: C calls
  `make_flat_adj_edges` **twice, cnt=1 each** (one aux graph per edge). The
  port calls it **once, cnt=2** (both edges in one aux → 2 real edges + a
  synthetic hvye between the same node pair → wider nodesep: auxt.y 155.19 vs
  C 113.11; sameports merges the two ports; the co-routed splines reverse).
  The port's `:S` spline comes out **reversed** — starts at structDefaultAuto
  (x≈158.3) and loops the wrong way to (213.5,−110.5) instead of starting at
  structParty:S (176.5,−102.4) and ending at structDefaultAuto (158.3,−8.0).
  That mis-routed loop grows GD_bb, shifting the whole flat region down 32.3px
  = the +33 height.
- **Origin**: The grouping lives in the **caller**, not the flat router.
  Port: `src/layout/dot/edge-route.ts:311` `collectAdjacentFlatGroup` groups by
  node-pair (either direction). C: `lib/dotgen/dotsplines.c:356-378` groups only
  while `getmainedge(e0)==getmainedge(e1)` (line 357) — two DISTINCT user edges
  have distinct main edges → separate cnt=1 groups. `ED_adjacent` (line 359)
  only bypasses the *port* comparisons, never the main-edge break. The port's
  comment at edge-route.ts:302-309 ("C groups every adjacent flat between a node
  pair into one call") is the wrong reading of C.
- **Secondary divergences (also outside splines-flat.ts)**: (a) even forced to
  cnt=1, the port picks the wrong `auxt` for the `:N` edge (structParty vs C
  structDefaultAuto) because C normalizes the lead edge with
  `makefwdedge`/BWDEDGE (dotsplines.c:351-354) before cloning — the port's group
  ordering does not. (b) The structParty `:N`/`:S` named-port cells resolve at
  p.y ±35.20 (port) vs ±24.40 (C) — an upstream HTML-table cell-position / port
  resolution difference (NOT set by the flat router; cloneEdge copies it in).
- **Ruled out**:
  - **rank=source (the mission's PRIME SUSPECT) is INERT** — the port's aux
    already ranks `auxt` at rank 0 (POSTPOS rank=0 in every dump, both cnt=1 and
    cnt=2). Adding an `agsubg rank=source` pin cannot change a 2-node aux where
    auxt is already the source. AD-2 is moot.
  - **HTML-table node sizing** — structParty is identical height (135.6) in both
    renders; structDefaultAuto identical (r=18). Not a node-size bug.
- **Scope verdict → STOP (AD-3)**: the fix locus is `edge-route.ts`
  (`collectAdjacentFlatGroup` grouping + lead-edge makefwdedge normalization) and
  likely the port-resolution path (sameport/htmltable for the ±24.40 cell y).
  NONE of these is `splines-flat.ts`. Two explicit README STOP conditions fire:
  "rank=source inert → re-diagnose, don't force" and "fix would touch a file
  other than splines-flat.ts". Batch 2 / T3 not entered; re-scope needed.
- **Confidence**: High (evidence: paired C/port DBG1949 dumps + cnt=1 experiment
  in decision-journal.md).

## Observation: TRUE root = inherited fontsize lost in cloneNode (aux node balloon)
- **Context** (2026-07-01, after user authorized bigger/aux-algo changes): the
  grouping, orientation (flatFwdEdge), and port-position hypotheses were all
  proven NO-OPS (byte-identical renders). Instrumented the aux NODE DIMENSIONS
  and found they diverge from C: port auxh(structParty) ht=122.19 vs C 64.80;
  port auxt(structDefaultAuto) ht=36 vs C 66.63.
- **Mechanism**: C's `cloneNode` does `agcopyattr` (materialises the origin's
  INHERITED attr values) then re-sizes via `dot_init_node`→`gv_nodesize`. The
  port's `cloneNode` copied only EXPLICIT attrs. structParty never sets
  `fontsize` — it inherits the graph-level `node[fontsize=8]` default via its
  `nodeDefaultsSnapshot`. The clone dropped that snapshot, and the bare aux graph
  has no node defaults, so the cloned structParty re-measured its HTML label at
  the built-in `fontsize=14` (label.dimen 54.68×78.40 vs the correct 40.67×56.80
  at 8pt) → the aux node ballooned ~2x → wider aux separation → oversized detour
  loop → +33px graph height. structDefaultAuto sets `fontsize=8` explicitly, so
  it was unaffected (and its fixedsize kept it 36) — which is why only structParty
  inflated and the earlier flat-router hypotheses looked like no-ops.
- **Origin**: `src/layout/dot/splines-clone.ts:cloneNode` — did not copy
  `orign.nodeDefaultsSnapshot`. Proven via DBG dump: main `nodeAttrResolved=8`,
  aux `nodeAttrResolved=undefined` → fontsize 14.
- **Fix (applied)**: `cloneNode` now copies `nodeDefaultsSnapshot`
  (`new Map(orign.nodeDefaultsSnapshot)`), mirroring agcopyattr. Result: aux
  structParty now byte-exact vs C (ht=64.80, lw/rw=28.34); 1949 height 315→304.
- **Ruled out**: rank=source (inert), grouping cnt (no-op), lead-edge orientation
  (no-op), port position ±35.2 (no-op) — all byte-identical experiments.
- **Confidence**: High — root proven by dump + the fix moving structParty to an
  exact match.

## Observation: residual 22px = structDefaultAuto fixedsize/HTML aux size (OPEN)
- After the fontsize fix, 1949 is 304 vs native 282 — a UNIFORM 21.54px shift
  (every node/element same size, shifted; separations unchanged). structParty aux
  size is now exact; the remaining aux divergence is structDefaultAuto: C grows
  it to 66.63 in the aux (circle enclosing its 31×30 HTML label × SQRT2 +
  margins, fixedsize NOT applied), the port keeps fixedsize=36. Dropping the
  `fixedsize` attr on clone did NOT move the height (port's small label doesn't
  grow the circle past 36), so the driver is likely the HTML PORT-CELL sizing
  (port measures the 3×3 empty-port table 31×30; C's is larger) and/or the still-
  reversed `:S` spline (starts at structDefaultAuto x=158.3, should be
  structParty:S x=176.5). Needs a follow-up pass. The fontsize fix is independent
  and lands on its own merits (pending 0-regression survey).

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
