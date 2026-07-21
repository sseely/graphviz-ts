<!-- SPDX-License-Identifier: EPL-2.0 -->

# Decision Journal — neato close-diverged

Append one row per non-trivial judgment call. Also record each task's interface
output (T1 `b1RootCause`, T2 residual summary, per-task classifications).

| Date | Task | Decision / Finding | Rationale | Evidence |
|------|------|--------------------|-----------|----------|
| 2026-07-20 | T1 | **b1RootCause** = neato component packing called `packGraphs` with `pinfo.doSplines` reset to `false` by `getPackInfo`, so `fillEdge` (poly-place) never followed routed splines; self-loop/curve bulges were undercounted in the polyomino, letting the neighbouring (lone) component pack one grid `step` (11pt) too close. | C sets `pinfo.doSplines=true` AFTER `getPackModeInfo`, right before `packGraphs` (neatoinit.c:1409); port set it in the literal then `getPackInfo` clobbered it to false. Also `fillEdge` only had the straight-line branch. | `nhg`: cc0 polyomino 119 cells (port) vs 123 (C `-v3`); missing (8,1),(8,2) blocked cell (3,-5). After fix: `Machine: a` x=160.29 (was 149.29), bb 199.58 (was 188.58) = oracle exact. `graphs-b`/`b117` also exact. |
| 2026-07-20 | T1 | **b1FilesTouched** = `src/layout/pack/poly-place.ts` (port spline branch of `fillEdge` + thread `doSplines`), `src/layout/neato/index.ts` (`layoutComponents`: set `pinfo.doSplines=true` after `getPackInfo`, matching C order). | Minimal faithful fix at origin; no change to `init.ts` (sizing was NOT the cause). | tsc clean; vitest 3206 pass; golden suite 406 pass; bundle 233KB. |
| 2026-07-20 | T1 | **b1SecondCause** = `2609`/`2258`/`2556` (and any B1 id with `overlap=false`) are MIS-BUCKETED: single-component graphs whose bb is ~0.43× the oracle's — an **overlap-removal under-scale** defect in `src/layout/neato/overlap.ts` / `maybeRemoveOverlap`, OUTSIDE T1's packing write-set. Classified as follow-up for T2 residual triage, NOT forced into T1. | `2609` is K4 (one component); node coords ~half oracle (264.46→103.94). Distinct root cause from disconnected packing; fixing needs overlap files not in write-set (brief: "flag as follow-up if it needs files outside this write-set"). | `2609` port bb 121.94×122.01 vs oracle 282.46×282.68; single-component path (`comps.length===1`). |
| 2026-07-20 | T1 | **Broad regression gate = CLEAN (BY ID).** neato: pass 660→665, diverged 95→90, **0 regressions**, 5 fixed (`graphs-nhg`,`graphs-b`,`graphs-b117`,`graphs-pgram`,`graphs-b94`). Deterministic engines circo/twopi/osage/patchwork: **0 previously-passing regressions** each. dot survey: **0 real regressions** — only delta is `1652`, a single-component 2547-node graph (my multi-component pack code path never executes for it; its `errored`/`oracle-error` verdicts are a known-slow-graph timeout + my mid-render survey kill, NOT a code regression). | Change is guarded: `fillEdge` spline branch only runs under `doSplines=true`; only neato component packing (and dot's multi-component pack, verified) set it true — all other callers pass false → straight branch byte-identical. `1652` proven single-component via parse+ccomps (1 comp / 2547 nodes / 3051 edges). | fresh deleted-JSONL sweeps; per-id delta vs git HEAD baselines: neato 0-regress/5-fix; circo/twopi/osage/patchwork 0-regress; dot 787/788 identical, 1652 exonerated. |
| 2026-07-20 | edge-label lp | **FIXED via frame alignment — 5 ids, 0 regressions.** Root cause found via same-frame trace: the port's candidate coords were offset from C's by a constant ~84 (the premature translate). neato `layoutComponents` called `shiftOneGraph(-bb.ll)` right after packGraphs, so `addXLabels` ran in the ORIGIN frame while C runs it in the PACKED (pre-translate) frame — C does the shift inside `gv_postprocess`'s `translate_drawing`, AFTER `addXLabels` (postproc.c:18 vs :75). `round()` in the xlabel obstacle rects (`objp2rect`/`objplp2rect`) then rounds differently between frames, tipping the edge-label side-selection knife-edge (lp off by exactly one label height). Fix: drop the premature `shiftOneGraph`; let `gvPostprocess`→`translateDrawing` do the shift (C's order). | share-nhg/windows-nhg/2476/2470 (edge labels) + bonus 2801 (arrow labels — also placed by addXLabels) now pass; neato 680→685, 75→70 diverged, 0 regressions by id. NOT a shared-primitive change — neato `layoutComponents`-only, so dot/circo/twopi/osage/patchwork unaffected. | share-nhg edge 2->1 label Y 58.94→42.14 (oracle-exact); full sweep 5 fixed / 0 regr. |
| 2026-07-20 | edge-label lp | **[SUPERSEDED by the FIXED row above]** Deeply localized, NOT landed (shared-primitive risk). share-nhg/windows-nhg/2476/2470: with C's node positions injected the labels still misplace, so it's a genuine placement bug. On share-nhg edge 2->1 ("other "): the spline is byte-identical and lp X matches (75.062), but lp Y is off exactly 16.8pt (one label height) — port picks candidate side (xR,yT) where the oracle picks (xR,yB). Localized to the `xladjust`/`xlintersections` candidate search (src/label/xlabels-intersect.ts): both sides scan the SAME 9 candidates in the SAME order and take the first zero-overlap or the min-area position, so the flip comes from `xlintersections` computing a different overlap n/area at (xR,yT)/(xR,yB). Instrumented both sides (port tryPos dump; C GVTS_XL_DUMP in lib/label/xlabels.c, rebuilt then reverted) and DID see differing n/area sequences — BUT the port dumps in the post-translate frame (positive coords) and C pre-translate (negative), so per-label alignment across the offset was NOT established; the exact obstacle-set/area divergence is UNCONFIRMED. NOT node-drift (attribution not-cleared; sibling "other " on 0->1 places identically). | Fix needs the exact divergence in `xlintersections`/`objp(lp)2rect`(round())/`aabbaabb`, a SHARED primitive used by every label graph. NEXT: dump port+C in the SAME frame (match a known label by its edge), then diff the obstacle set at the (xR,yT) candidate. Deferred rather than patch a shared primitive on an unconfirmed mechanism. | lp Y 63.142 vs 46.342 (exactly one label height); spline + lp X identical. |
| 2026-07-20 | dotsplines/weight/crazy | **A1-drift-dominated + irreducible FP-clip residual — accept-class, not a clean fix.** Same pre-laid-out unix graph (splines=line, ellipse nodes) rendered under neato. Attribution already cleared most (base 79/61/36→inj 30/22/14). Isolated the residual via `GVTS_POS_INJECT` (inject C's exact ND_pos, re-render, diff vs oracle): with identical positions only 3 of 55 edges exceed 0.5pt (max 0.652). Those 3 are near-degenerate stubs between nearly-touching large ellipses, and their clip errors are SCATTERED in direction ((-0.61,+0.23),(+0.34,-0.50),(+0.53,-0.08)) — FP sensitivity in the near-tangent line-ellipse clip, not a systematic algorithm bug. Base (non-injected) diffs add A1 majorization drift (node scatter stdev 0.14pt + ~0.18pt systematic; bb 1014.7 vs 1014.4). | No faithful fix: the port's clip is faithful; the residual is FP-amplification on degenerate geometry (like 241_0). Not worth a shared ellipse-clip change (dot+neato regression risk) for ~0.15pt on 3 edges. Accept-class (A1 amplified). | injected-position residual: 3 edges >0.5, scattered clip directions. |
| 2026-07-20 | #3 241_0 | **PROVEN IRREDUCIBLE — not a fixable bug; accept-class (A1/A9 amplified by a degenerate corridor).** Full trace via instrumented C (neato plugin rebuilt): edge 1:se->6:sw routes through `makeMultiSpline`. C's `triPath` finds the SAME degenerate (non-simple, self-intersecting) 10-vertex corridor as the port, but C's `Pshortestpath` REJECTS it (returns -1: after triangulation the endpoint vertex is in no triangle) → makeMultiSpline fails → fallback to `makeSplineEdge` → clean 4-pt bezier. The port's `shortestPath` is **algorithmically correct**: fed C's EXACT corridor it also returns null (fail) — verified by direct call. The ONLY divergence is that the port's corridor vertices are ~0.2pt off C's (node-position A1 drift; attribution not-cleared ⇒ persists with C's ND_pos ⇒ CDT incircle ULP too, the A9 class), and on this knife-edge degenerate corridor the 0.2pt tips shortestPath fail→success → 7-pt over-segmented spline. No faithful code change fixes it (port routing + shortestPath + isdiagonal + pointInTri + ccw all match C; ccw is bit-matched). | Valid stop condition #2 (root cause identified + proven irreducible with a controlled experiment: port shortestPath on C's exact corridor = null). Same transcendental-ULP-tie family as the accepted dot-track 241_0/241_1/2368 (A3) and the A9 CDT tie-flip. Candidate for the A1/A9 accept registry. graphs-b81 earlier RE-SCOPED to A1 similarly. | C psp=-1 on corridor [(120.354,225.261)…]; port shortestPath on that exact corridor = NULL; port's own (drifted) corridor = 3-pt path. |
| 2026-07-20 | #3 241_0 old | **[SUPERSEDED]** Diagnosed, not yet fixed (deep spline-routing, deferred to avoid rushing shared code). `1:se->6:sw` is a flat (rank=same) edge with compass ports; node positions match the oracle (~0.3pt drift, drift-exonerated elsewhere), but the port routes a 7-point/2-segment spline (`B 7 120.35 225.51 … 138.36 172.84`) where the oracle uses a single 4-point bezier (`B 4 120.35 225.26 … 142.69 176.32`) — the port OVER-SEGMENTS. Mechanism: node 1/6's polys become Proutespline barriers (subdivided) where C excludes them. C's `in_poly` (pathplan) is boundary-inclusive (`wind()==1` → outside only); the port's `inPolyHelper` matches structurally, so the compass-port endpoint likely falls just-outside the port's poly OR the edge routes via a different path (it does NOT hit `installSpline`/makeSpline for this edge — routing dispatch not fully traced). NEXT: trace which routing fn emits this edge (installPline/makeStraightEdges vs makeSpline) and where the extra segment enters. graphs-b81 was RE-SCOPED: drift-exonerated (A1), NOT a text-measure bug. | Fixing needs shared pathplan/neato-spline changes with regression risk; the routing path wasn't fully isolated within a prudent bound at session end. Precise diagnosis handed off rather than a half-traced patch. | oracle B4 vs port B7 on 1->6; node pos match. |
| 2026-07-20 | #1 node-drift | **PROVEN irreducible A1; 56 ids auto-classified drift-exonerated (CLOSED per D2).** On clust1: init is bit-identical (drand48 bit-matches C POSIX; node order = agfstnode a0..x) and the convergence criterion matches C (stress.c:1072), yet the final shape differs ~0.5pt with NO rotation (Procrustes 0.00°). Controlled experiment: a 1e-5 perturbation to one initial coord → 2.2pt final move (amplification ~1e5) — the CG majorization is chaotically sensitive, so V8-vs-C float32 op-order (~1e-7/op) amplifies to ~0.5pt over ~140 iters. Irreducible without bit-exact solver replication. Ran the injection-attribution harness (POS_DUMP-patched neato plugin + attribute-divergence.ts): of 75 diverged, **56 drift-exonerated** (inject C's ND_pos → conforms ±0.5 = A1), **17 not-cleared** (genuine), 2 harness-error (pgram inject timeout). b81's 2× bb was ALSO node-drift (drift-exonerated), NOT text-measure — my earlier hypothesis was wrong; the harness caught it. | The A1-drift class is computed at report time from attribution-neato.json, so the 56 close automatically (no registry edit). 76 of the original 95 now fixed-or-classified (20 fixed + 56 A1). Genuine remainder = 17: edge-label lp (share-nhg/windows-nhg/2476/2470), spline structural (241_0/1990), arrow-label (2801), spline _draw_ residuals (dotsplines/weight/crazy/rankdir ×7), big cluster (2193/2239), + pgram perf. | perturbation 1e-5→2.2pt; attribution-neato.json 56/17/2. |
| 2026-07-20 | triage | **Remaining-75 characterization (post-GF-A).** Probed every residual bucket: no more single-cause "lever" like B1/GF-A remains. B3-cluster (4) is a proven node-position-drift cascade (nodes drift 0.15–0.74pt; cluster bbox follows). B2-spline (43) is mostly <1.3pt near-tolerance drift (self-loop-port routing e.g. sr_box/sl_box, rankdir, etc.) + 2 genuine 6pt outliers (241_0 spline ptCount 14-vs-8, 1990). B4-label (8) heterogeneous (nhg 16.8pt, train11 5.6pt, 2470 78pt, b29 large, 1652 slow). graphfill-residual 17 = A1-drift accept-class (root_twopi/circo/2475_2, n=22k–283k) + GF-C over-scale (graphs-b81 2× text-measure, 2242). | The clean wins are captured (20 ids, 0 regr). The tail needs deep per-id work: a core stress-solver drift investigation (biggest lever, uncertain reducibility, files outside every Batch-3 write-set), structural-outlier digs, and A1 accept-classification with controlled experiments. Not GF-A-style bulk fixes. | `residual-tracker.md` POST-GF-A UPDATE section; clust1 node-pos comparison. |
| 2026-07-20 | GF-A | **overlap-removal dispatch fixed (user-authorized `overlap.ts`/neato scope).** neato's `maybeRemoveOverlap` hardcoded VPSC for every non-`true` overlap; C's `removeOverlapWith` dispatches by mode — `overlap=false`→AM_PRISM (`fdpAdjust`), `overlap=scale/scalexy/compress`→scAdjust, only `overlap=vpsc`→VPSC. Routed the non-vpsc path through the existing `adjustNodesFull` (already used by twopi/circo). **15 fixed, 0 regressions**, neato 665→680 pass / 90→75 diverged. | 2609/2258/2556 + overlap_neato/neatosplines/newarrows/arrows families were single-component `overlap=false` graphs under-scaled ~0.4–0.8× by VPSC; PRISM matches oracle exactly. overlap_neato1 is `overlap=scale`→scAdjust (also fixed). Change is neato-only (`maybeRemoveOverlap` callers: neato index.ts:215,263) → dot/circo/twopi/osage/patchwork provably unaffected, no re-sweep. | bb oracle-exact on 2609/2258/2556/overlap_neato/neatosplines; near-miss arrows_dot/newarrows-mirror/overlap_neato1 graduated from graph-fill to ~1pt B2-spline residuals (bb now correct). tsc/vitest 3206/bundle green. |
| 2026-07-20 | T2 | **Residual triage complete → `residual-tracker.md`.** 90 diverged split: graphfill 38, B2-spline 37, B4-label 8, B3-cluster 4, B5-arrow 3. Triaged from T1's committed fresh sweep (firstDiff already in the jsonl — no re-sweep needed). **Acceptance target (≤51) NOT met** and won't be by the planned batches: the graph-fill 38 subdivide into GF-A overlap-scale (~16, `overlap.ts`, outside all write-sets), GF-B near-match/A1-drift (~19, mostly accept-class incl. root_twopi/circo/2475_2 at 30k–283k nDiffs), GF-C over-scale outliers (3, incl. `graphs-b81` 2×). | The B1 "bucket" clustered by the graph-fill *symptom*, not one cause. Batch 3 (B2/B3/B4/B5) covers 52 of 90; the 38 graph-fill are unassigned to any task. This is a plan cost-model error, not a T1 failure. | bb ratio analysis in `residual-tracker.md`; 2609 confirmed single-component overlap-scale. |
| 2026-07-20 | T1 | **Pre-existing gate breakage** (not introduced by T1): `bash test/golden/gates.sh` cannot exit 0 at HEAD — Gate 3 (`run.sh`) needs `dist/cli.js` which no source produces (stale harness from f1bf494); Gate 4 fails on 7 pre-existing files >600 lines (`dot.ts` 1500, `splines.ts` 1008, …). Effective gate used: Gate 1 (tsc) + Gate 2 (vitest incl. golden `suite.test.ts`/`xdot-suite.test.ts`) + Gate 5 (bundle) — all green. | Verified identical failure on stashed clean HEAD (`Cannot find module dist/cli.js`). Out of T1 write-set; golden coverage genuinely exercised via vitest. | clean-HEAD Gate 3 fails same; golden vitest 406 pass; bundle 233758 < 512000. |

## 1990 ortho — CORRECTED classification (2026-07-20)

Earlier I called 1990 a "distinct fixable bug." **That was wrong** — deep
tracing (instrumented C ortho plugin) proves it is the **same irreducible
A1-drift pattern**, amplified through the ortho maze's `isSmall` threshold:

- Edge `1:se->6:sw`... (actually `0⋯7 ❰A❱ -> 0⋯1 'a'`) over-segments (B7 vs
  oracle B4) because the port's `shortPath` cost is 555 (a bend) vs C's 12
  (straight). Same maze cells, same constants (delta=1, mu=500, BIG=16384).
- Root: the gap routing cell between the two nodes has width **6.987 in the
  port vs 7.2 in C**. `isSmall(w) = (w-3)/2 < 2` i.e. width < 7.0. C's 7.2 is
  not small (straight T-B edge weight 12); the port's 6.987 IS small, so
  `vwt=BIG` blocks the straight edge → detour.
- The 0.2pt width difference is the tail box left edge (tail.x − lw): port
  tail.x=85.8 vs C 85.7. **1990 has no `pos=`** → neato lays it out from
  scratch by stress majorization → that 0.1pt tail.x delta is A1 float32
  drift. Confirmed: lowering the port's isSmall threshold below 1.9 makes the
  edge route B4 (oracle-exact), proving the isSmall tip is the sole cause.
- The attribution harness mislabeled it "not-cleared" because its position
  injection sets `n.info.pos` but the ortho maze reads `coord`, so injection
  never reaches ortho routing — a harness blind spot, not evidence of a
  non-drift bug.

**Conclusion:** 1990 is accept-class (A1-drift amplified by the isSmall maze
knife-edge). No faithful fix (the port's ortho algorithm matches C;
reproducing C requires C's exact node positions = irreducible). All three
deep residuals investigated (241_0, dotsplines, 1990) are irreducible A1/FP
cascades. LESSON: verify a "genuine bug" to its origin — the attribution
harness's not-cleared verdict can be a harness blind spot, not proof.

## 2193 & 2239 — characterization (2026-07-20)

**2239 (n=3838): A1-amplified packing arrangement — not cleanly fixable.**
Multi-component (C's -v shows multiple majorization runs; 80 nested clusters,
94 nodes, no pos=). Each component is laid out IDENTICALLY internally
(intra-cluster relative vectors match C to ~0.15–0.48pt = A1 drift), but the
components are PACKED in different positions (inter-component deltas 340–710pt;
node scatter dx sd 186 / dy sd 255). So it's a packing-arrangement divergence,
most likely A1 per-component drift tipping polyomino packing tie-breaks (qsort
perimeter ties on near-equal components). GVTS_POS_INJECT was inconclusive
(behaved anomalously for this 80-component nested-cluster case — bb went to a
third value), so not definitively confirmed, but the internal-match + external-
scatter signature is the A1-amplified pattern.

**2193 (n=1085): genuine systematic ~1.5pt Y-offset + A1 — the one distinct
non-drift component found.** Single-component (1 majorization run), 57 nodes,
center=true, ratio="0,01" (malformed). Procrustes: scale 0.99994 (none),
rotation -0.014deg (none), but a UNIFORM dy = -1.53pt (sd 0.34) translation;
post-rigid-fit residual mean 0.36pt (A1). The whole drawing sits 1.53pt lower
with bb 1.5pt taller (1682.4 vs 1683.9). NOT pure drift — a systematic bb-
height / centering / margin computation difference. Origin not yet pinpointed
(candidates: center=true centering offset, ratio="0,01" handling, or a graph/
label bb-expansion rounding). This is the most promising remaining fixable
candidate, though small (~1.5pt). Distinct from the A1/FP-cascade pattern of
241_0/dotsplines/1990/2239.

## CORRECTION — 2193/2239 reversed; injection parser was blind to space-named nodes (2026-07-20)

The "2193 & 2239 — characterization" entry above is **WRONG and superseded**.
It was produced with a broken injection harness. `injectOraclePositions`
(src/layout/neato/splines.ts) parsed dump lines with `/^GVTS_POS (\S+) …/` —
a space-free node name. Every node in 2193, 2239, crazy, dotsplines, weight,
and rankdir has a name **containing spaces** (multi-line labels used as ids,
e.g. `"5th Edition"`, `Check if there is at least\none active IC headstage`).
So the injector silently matched ZERO nodes on those graphs and injected
nothing — the "injected" render was identical to the port's own drifted
layout. That is why 2193 looked like it "survived injection" (→ falsely
"genuine non-drift") and 2239's bb "went to a third value" (→ falsely
"A1 packing"). Both conclusions were harness artefacts.

**Fix:** `/^GVTS_POS (.+) (\S+) (\S+)$/` — greedy name, x/y are the trailing
two tokens. Handles space/`\n`-containing names; still correct for simple
single-token names. (splines.ts, this commit.)

**Re-tested with the corrected parser (injected node positions vs oracle
xdot, tol 0.5, sweep comparator):**

| id                | non-injected nDiffs | INJECTED nDiffs | verdict |
|-------------------|--------------------:|----------------:|---------|
| 2193              | 1085 | **0** | A1 drift (exonerated) |
| nshare-dotsplines_dot  | — | **0** | A1 drift |
| nshare-dotsplines_dot1 | — | **0** | A1 drift |
| nshare-weight_dot      | — | **0** | A1 drift |
| share-crazy            | — | **0** | A1 drift |
| windows-crazy          | — | **0** | A1 drift |
| nshare-rankdir_dot     | — | **0** | A1 drift |
| nshare-rankdir_dot1    | — | **0** | A1 drift |
| linux.x86-rankdir_dot2 | — | **0** | A1 drift |
| 2239              | — | **3838** (bb 1702.77 vs 1957.13, Δ254) | GENUINE post-layout defect |

So of the 12 neato `not-cleared` ids, **9 are actually A1 drift** (their
not-cleared verdict was the parser blind spot) and only **two remain genuine
non-drift**: `241_0` (FP-irreducible compass-port, proven separately) and
`2239` (post-layout — injected centres match but the render still diverges by
3838 diffs; the port draws the whole graph 254pt SMALLER, i.e. a label/text
sizing shortfall on `\l`-justified multi-line labels; distinct fixable bug).

**2193 final classification: A1 (float32 stress-majorization drift),
irreducible.** With C's node positions injected the port reproduces the oracle
bb (1682.42 × 1608.66) and full xdot exactly (0 diffs); the ~1.5pt Y-offset is
entirely drifted node coordinates, not a centering/ratio/bb bug. The port's
spline/bb/emit machinery is byte-perfect on this graph.

**Harness lesson (added to memory):** a `\S+` name field silently drops every
space-named node — and a no-op injection is INDISTINGUISHABLE from "survives
injection" unless you check the match count. Any attribution verdict on a
space-named graph produced before this fix is suspect. Re-running the full
neato attribution `--fresh` to regenerate verdicts.

## 2239 — pinned-node fixed packing ported (2026-07-20)

**Not a label bug.** Every node's rendered box matches the oracle exactly
(95 objects compared, 0 size mismatches); the divergence was pure component
PLACEMENT. 2239 is a 7-connected-component (10 packed graphs incl. singletons)
disconnected neato layout with a pinned `legend` node (`pos="0,0!"`).

**Root cause:** the polyomino packer's FIXED (pinned) protocol was unported.
When a graph has a pinned node, C (pack.c:putGraphs) computes `center` = the
midpoint of the pinned component's bbox and passes it to genPoly for EVERY
component (dx = center.x - round(GD_bb.LL.x)); it then places fixed components
via placeFixed (at -center) and the rest via placeGraph. The port hardcoded
`center=(0,0)` and skipped placeFixed ("pinfo.fixed protocol not ported").

The center offset shifts every component's grid phase identically, which is
load-bearing: without it a singleton's box straddled 9 cells vs C's 6, tipping
perimeters → qsort order → arrangement. Instrumented C (GVTS_COVER_DUMP /
GVTS_FIX_DUMP) proved center=(141,31), and that fixed[i] is indexed by the
SORTED loop position (not sinfo[i].index) — a pack.c original-vs-sorted index
quirk that fixes the LARGEST component at -center and packs the pinned one
normally. Replicated exactly.

**Fix (3 sites):**
- poly-place.ts: genPoly takes `center`; polyGraphs computes fixed_bb/center,
  runs placeFixed for the fixed loop-index components then placeGraph for the
  rest. Backward-compatible: center=(0,0) with fixed=null ⇒ identical to before,
  so only pinned+multi-component graphs change (2239 alone in the corpus).
- pack/index.ts: pccomps merges pinned-node components into index 0 (C order).
- neato/index.ts: layoutComponents uses pccomps, sets pinfo.fixed=[true,false…]
  after getPackInfo (which resets it), mirroring neatoinit.c.

**Result:** diffs 3838 → 1862. legend + the largest components now place
EXACTLY as C (idx0,1,3,4,8 match to the point). Residual is A1: with C's node
positions injected the port's polyomino cell counts match C exactly
(81,66,42,57,25,21,6,6,6,6), proving the packer is now byte-faithful and the
remaining divergence is float32 stress-drift in edge splines amplified through
the discrete greedy packer (a few drifted cells flip a later component's slot).
Classified A1-amplified-pack (accepted). The attribution harness can't
auto-verify it: injection is per-component pre-pack, so on a multi-component
graph it re-packs (double-transform) rather than reproducing C — a known
harness limitation, hence the per-id accepted entry rather than a
drift-exonerated verdict.
