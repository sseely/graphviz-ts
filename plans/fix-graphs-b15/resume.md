<!-- SPDX-License-Identifier: EPL-2.0 -->
# Resume prompt — graphs-b15 make_regular_edge group-router rewrite

Paste the block below into a fresh, focused Claude Code session (recommended:
`claude-opus-4-8`, extended thinking for the `make_regular_edge` design). The
diagnosis is fully banked on disk; the new session goes straight to
implementation with the C oracle.

State on entry: branch `fix/graphs-b15-edgecmp` is **docs-only** (T1 + T2
diagnosis committed, `src/` clean at `main`); `main` unchanged. Nothing to clean
up first.

---

```
Faithfully port C's make_regular_edge group-routing to fix graphs-b15
(concentrate drops 6 edges). This is a scoped continuation of a fully
diagnosed problem — do NOT re-diagnose from scratch.

## Read first (the diagnosis is done)
- plans/fix-graphs-b15/README.md — mission + AD-1..AD-5
- plans/fix-graphs-b15/decision-journal.md — full history (3 sessions)
- .agent-notes/graphs-b15-collect-design.md — the SHARPENED root cause and the
  4-part fix shape. This is the spec for the work.
- Branch: work on `fix/graphs-b15-edgecmp` (docs-only so far; src is clean at main).
- C spec: ~/git/graphviz/lib/dotgen/dotsplines.c (make_regular_edge, the group
  loop at 344-419, getmainedge:99, edgecmp:535) and conc.c.

## The bug (confirmed, do not re-litigate)
`concentrate=true` drops 6 back edges (maxDelta 0, svg/g[1][childCount]; port 147
vs oracle 153). Root cause: dotSplines_ (src/layout/dot/splines.ts) collects only
NORMAL nodes, so virtual splineMerge nodes' secondary chains never route. The
collect fix (iterate the rank array incl. splineMerge nodes) is necessary but
insufficient: the port's dedupByOrig/routeMergedChain/routeLoneEdge dispatch, and
groupSize's cross-rank portEq split, FRAGMENT same-getMainEdge chain segments, so
routing the secondaries double-installs beziers on 8 unrelated long edges
(reproduced: maxDelta 432). C avoids this: its group loop breaks only on
getmainedge and make_regular_edge routes each getmainedge group ONCE, handling
multi-orig (samehead) + multi-segment internally.

## The fix (faithful port — AD-2/AD-3: no boolean guards, no side routers)
Port C's make_regular_edge group model. Work in this order, gating after EACH step:
1. Collect from the rank array (minrank..maxrank, null-guard .v slots), keeping
   the existing nodeNeedsRouting gate. Mirror dotsplines.c:281-320.
2. groupSize: group by getmainedge exactly as C (dotsplines.c:344-383) — ea/eb =
   e0/e1 if it has a defined port else getmainedge; portcmp; ED_adjacent; flat
   label; MAINGRAPH break. Stop fragmenting same-getmainedge chain segments.
3. Replace the dispatchEdgeGroup decomposition with a faithful make_regular_edge
   that routes one getmainedge group once, installing spl per distinct original
   using all its collected segments. Study conc.c merge topology — the port's
   conc.ts yields two normal-tail chains per samehead orig vs C's merged one;
   reconcile so segments compose into one route per orig.

## Guardrails (hard)
- Bar = graphs-b15 conformant (153 edges, all 6 named edges) AND compareSvg
  maxDelta stays ~0. Edge count alone is a FALSE signal (prior fix hit 153 @ 432).
- Gate every step: render b15 and check edges + maxDelta via
  test/golden/compare.ts. Before finishing, run the full survey and rules-gate
  vs COMMITTED HEAD (git show HEAD:test/corpus/parity.json) — 0 regressions,
  0 maxDelta rises across the 789 corpus. Concentrate graphs to watch: 2559,
  b69, 2361, honda, share-b15, windows-b15.
- Env: survey/tsx via the npx-cached tsx with TSX_BIN set, GVBINDIR=/tmp/ghl
  (npm run survey:setup builds it). To instrument C, rebuild the dot_layout
  plugin (cd ~/git/graphviz/build && make gvplugin_dot_layout) — /tmp/ghl
  symlinks it; revert + rebuild pristine after.
- STOP if the same site is changed 3× without converging, or any other corpus
  id regresses. Keep the C tree clean; keep src clean between committed steps.

## Deliverable
graphs-b15 diverged→conformant, 0 corpus regressions, then refresh
parity.json/parity-rules.json/PARITY.md and merge fix/graphs-b15-edgecmp with a
merge commit. If it proves intractable at the make_regular_edge port, stop and
document why in the journal — do not force edges to hit a count.
```
