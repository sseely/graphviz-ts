# RCA: twopi "splines=ortho" divergence family (144_ortho, 144_no_ortho, 2361, 2183)

Date: 2026-07-11. Engine: twopi. Compare: xdot @ 0.01 (deterministic).

## Summary — two independent mechanisms, not one

The prior attribution ("all ortho routing") was wrong for half the family. Node
positions match the oracle EXACTLY for all four ids (verified by diffing the
node `pos="x,y"` sets) — so none of these is A1 radial drift. There are two
distinct mechanisms:

| id            | node pos | mechanism                              | status              |
|---------------|----------|----------------------------------------|---------------------|
| 144_no_ortho  | match    | M1 port-label shift omission           | FIXED — conformant  |
| 144_ortho     | match    | M1 (fixed) + M2 ortho bezier residual  | 14→8 diffs (M2 left)|
| 2361          | match    | M2 ortho routing (concentrate)         | 184 diffs (M2)      |
| 2183          | match    | M2 ortho routing (concentrate+cluster) | 79 diffs (M2)       |

Note: 144_no_ortho does NOT set splines=ortho (misleading name) — it proves M1
is unrelated to ortho.

## Mechanism 1 — head/tail (port) label left behind by normalizeGraphBB — FIXED

**Symptom.** 144 firstDiff `_hldraw_` text x: port 46.05 vs oracle 52.87
(also `_tldraw_` 7.95 vs 14.77). Constant −6.822 on every head/tail label; y
correct; node ellipses, bb, and splines all matched the oracle already.

**Causal chain (instrumented, both sides).**
1. twopi `spline_edges` (neatosplines.c:836) translates nodes to LL-origin,
   routes, then `place_portlabel` (splines.c:1316) places head/tail labels
   relative to the spline endpoint. At that moment node A is at x=27 (LL=0),
   so the label lands at x=46.05. `updateBB` expands GD_bb.LL.x negative
   (−6.822) to include the labels. — The port reproduces this exactly:
   after `splineEdges`, A.pos=27pt and bb.ll.x=−6.822 (matches C).
2. C then runs `dotneato_postprocess → gv_postprocess`: `Offset = GD_bb.LL`
   (negative), `translate_drawing → map_edge` (postproc.c:98) shifts nodes,
   splines, AND `ED_head_label/ED_tail_label` by −Offset (+6.822) together →
   node→33.822, label→52.87. All move as one.
3. The port instead re-normalizes inside the twopi driver:
   `normalizeGraphBB` (src/layout/pack/index.ts:236) → `shiftOneGraph` →
   **`shiftEdgePoints` (pack/index.ts:189)** shifts node coord/pos, spline
   points, and arrow ops by +6.822 — but translated ONLY `e.info.label`
   (center edge label), omitting `xlabel`, `head_label`, `tail_label`. So the
   port labels are left at 46.05 while everything else moves to 33.822. By the
   time `gvPostprocess` runs, bb.ll is already 0, Offset=0, and
   `translateDrawing` early-returns — the labels never get their shift.

**Origin.** `shiftEdgePoints` (src/layout/pack/index.ts:189) vs the C reference
`lib/pack/pack.c:shiftEdge`, which moves ED_label, ED_xlabel, ED_head_label,
ED_tail_label (all four, in that order) before the spline. The port moved only
one — a faithful-port omission.

**Fix.** Add xlabel, head_label, tail_label translation to `shiftEdgePoints`,
mirroring pack.c:shiftEdge exactly. After fix, all six 144 head/tail labels
match the oracle bit-for-bit; 144_no_ortho is fully conformant; 144_ortho's 6
label diffs are gone.

**Ruled out.** (a) place_portlabel formula — verified port pe/pf/angle/dist
identical to C, only the endpoint x was pre-shift. (b) label emission
(labelSpanX/renderOneLabel) — correct; T-op x = lp.pos.x for centered labels.
(c) translateDrawing/mapEdge — DOES map head/tail labels correctly, but never
runs for twopi because normalizeGraphBB already zeroed bb.ll (Offset=0).
(d) node/spline positions — matched oracle before and after.

**Blast radius.** `shiftEdgePoints` is shared by the packing path
(normalizeGraphBB for twopi; shiftGraphs for osage/circo/pack/dot-multipart).
The change only ADDS translations the C already performs, so it can only fix,
never regress. Verified: twopi 12/12 passing ids, osage 6/6, circo 6/6, all
committed golden + divergence tests (339) and pack/twopi/splines-label/postproc
unit tests (141) still green. 144_no_ortho flips diverged→pass.

## Mechanism 2 — ortho routing/bezier generation under twopi — IDENTIFIED, DEFERRED

**Scope.** 2361 (184 diffs, 12 edges), 2183 (79 diffs), 144_ortho residual
(8 diffs, edge D->C). Node positions match the oracle exactly → real routing
divergence, NOT drift and NOT irreducible (deltas 4–206 pt, not ULP).

**Evidence.**
- 144_ortho D->C: identical spline endpoints (s=33.822,36.169 e=33.822,71.587),
  but the port emits ortho control points `[P0,P0,P1,P1]` = 46.754,46.754,
  60.368,60.368 (duplicated), while the oracle emits interpolated controls
  46.71,51.294,56.043,60.642. The duplication is produced by the port's
  faithful `buildSpline` (src/ortho/index.ts:67, port of ortho.c:mkspacep) —
  so the oracle did NOT route this segment through the same ortho buildSpline;
  it produced a fitted/interpolated bezier. This is an ortho-vs-straight
  per-edge dispatch / bezier-fit difference in the ortho pipeline.
- 2361 AC->CI: whole vertical segment at x=289.16 (port) vs 282.77 (oracle),
  constant +6.39 — an ortho maze channel-position (track) selection difference.
  AC's node box is byte-identical, so it is the maze grid/track assignment, not
  node sizing. 2361 diffs span a wide delta range (6→206 pt) across 12 edges =
  substantially different ortho routes under concentrate=true.

**Why deferred, not fixed here.** M2 lives in the ortho maze
(partition/maze/track-assign) and ortho↔straight dispatch under the neato-family
spline path — a dedicated mission. Per CLAUDE.md sweep discipline, any routing
change needs a fresh full-corpus sweep (0 regressions) before commit; the ortho
router underpins 700+ passing ortho ids across twopi/osage/circo, so an
un-swept edit here is unsafe. Filed as follow-up.

**Not an acceptance class.** M2 is a genuine, fixable algorithmic divergence
(real route/track/fit differences), so it must NOT be accepted as A1 or any
ULP class. It stays tracked as "diverged" pending the ortho mission.
