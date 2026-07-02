<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: retire A2 — re-diagnose the NaN family's edge-endpoint residual

## Objective

The A2 "text measurement → layout" accepted-divergence class pre-dates the
text-measurement neutralization (both survey sides run `estimate_textspan_size`
via the headless `/tmp/ghl` oracle). Its only remaining members —
`graphs-NaN` / `share-NaN` / `windows-NaN` (`structural-match`, maxΔ 18) — are
misclassified by the doc's own 2026-06-30 status note: **all 76 node reference
points match C exactly**; the residual is **8 straight edges** (4 pairs:
`Target↔TThread`, `Interp↔InterpF`, `Event↔Target`, `AtomProperties↔NRAtom`)
whose endpoints shift 6–14 pt with matching piece counts. Re-diagnose that
residual to a stated mechanism, fix faithfully if it is a port defect, and
retire the A2 entries per the truth-first outcome ladder (decisions.md D1).

## Branch

`fix/nan-a2-retire` (from `main`). Merge back with a **merge commit**.

## Constraints

**Stop conditions**
- **Write-set expansion ask:** diagnosis or implementation implicates files
  outside the declared write-set → STOP before editing, present the implicated
  `file:line` list + the mechanism artifact, and request expansion approval
  (approval expands the write-set, logged in the journal; denial =
  document-and-halt). Applies to T3 mid-implementation too.
- Any other corpus id regresses (verdict, or maxDelta rise not explained by a
  controlled experiment) in survey/rules-gate vs committed HEAD.
- Same site changed 3× without converging on the same failing check.
- Two consecutive quality-gate failures on the same check.
- An "irreducible" claim without a controlled experiment isolating the variable.
- Implementation contradicts decisions.md.

**Push-forward (decide and log)**
- Instrumentation wording/format; which extra concentrate/straight-edge graphs
  to spot-check; journal phrasing; unit-test shape; §A2 prose wording (within
  the D2 Stage-1 truth constraints); commit wording.

## Quality gates

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run          # includes accepted-divergences.test.ts guard
  pass: exit 0
  on_fail: fix_and_rerun
- command: NaN per-element gate (render graphs/share/windows NaN.gv vs oracle;
           per-title compare — see batch-2/T4 for the recipe)
  pass: nodes-differing = 0 on all 3; edges-differing = 0 after T3
  on_fail: stop
- command: survey + rules-gate vs COMMITTED HEAD parity.json
           (TSX_BIN=<npx-cached tsx> GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json
            $TSX_BIN test/corpus/survey.ts && $TSX_BIN test/corpus/rules-gate.ts)
  pass: exit 0; 0 regressions; maxDelta movers each explained
  on_fail: stop
- command: git diff --name-only (per task)
  pass: only the task's declared (possibly expanded-by-approval) write-set
  on_fail: stop
```

Env notes: `node_modules/.bin/tsx` is absent — use the npx-cached tsx with
`TSX_BIN` set (the survey honors it; npm's bare `tsx` scripts do NOT — invoke
`$TSX_BIN test/corpus/survey.ts` directly). `npm run survey:setup` builds
/tmp/ghl. C instrumentation: edit `~/git/graphviz/lib/dotgen/dotsplines.c` (or
`lib/common/splines.c`), `cd ~/git/graphviz/build && make gvplugin_dot_layout`;
/tmp/ghl symlinks it — **revert + rebuild + byte-verify the oracle before any
survey**.

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — Stage-1 truth pass ∥ diagnosis | [x] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — faithful fix + watch gate (skip if T2 ⇒ irreducible) | [x] | [batch-2/overview.md](batch-2/overview.md) |
| 3 — survey, Stage-2 retire, merge | [x] | [batch-3/overview.md](batch-3/overview.md) |

## Index

- [decisions.md](decisions.md) — D1 truth-first ladder, D2 two-stage cleanup,
  D3 C-first instrumentation, ops notes
- [batch-1/T1](batch-1/T1-doc-truth-pass.md) · [batch-1/T2](batch-1/T2-diagnose-edge-residual.md)
- [batch-2/T3](batch-2/T3-faithful-fix.md) · [batch-2/T4](batch-2/T4-watch-graph-gate.md)
- [batch-3/T5](batch-3/T5-survey-retire-merge.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) · [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Prior evidence: `docs/known-divergences.md#a2…` (status note + superseded
  analysis), `plans/fix-compress-xcoord/comparisons/nan-compress-xcoord.md`,
  `.agent-notes/b15-per-entry-run-routing.md` (B15DUMP recipe + compareSvg
  childCount blindness), memory `a2-collapsed-proc3d-conformant`.

## Mission summary (2026-07-01)

**Outcome: D1 ladder rung 1 — port defect(s), fixed faithfully; NaN family
conformant on all 3 dirs; A2 retired.**

- Tasks: 5/5 planned completed (T1 doc truth pass · T2 diagnosis · T3 faithful
  fix · T4 watch gate · T5 survey/retire/merge). Batch 2 ran (port-defect path).
- Mechanism (T2): not font metrics and none of the doc's three candidates —
  opposing 2-cycle lane assignment. The port re-sorted parallel groups by orig
  seq; C assigns Multisep lanes in edgecmp collected order. Confirmed by
  forced-order experiment (0/0 per-element ×3) before any src edit.
- Fixes (T3, two write-set expansions user-approved): splines-groups.ts lane
  order; flat.ts markAdjacent same-rank guard (second defect exposed by the
  first fix, C flat.c:272-276). Fix-sensitive regression test added.
- Collateral improvements: 42, clust2, ngk10_4 → conformant; b124 diverged →
  structural-match (all 2-cycle/parallel-pair graphs).
- Gates: tsc 0; vitest 2546/2546; NaN per-element 0/0 ×3; watch set
  byte-identical pre/post except NaN; survey 789 ids, rules-gate PASS,
  0 regressions; C tree reverted + oracle byte-verified after each
  instrumentation round.
- Decisions journaled: 15 rows; 2 write-set expansions (both approved);
  2 push-forward guard-test syncs.
- Follow-ups: routeCurvedGroup's origSeq sort (splines=curved path) carries the
  same suspect pattern — no observed defect, assess against routespl.c in a
  future mission (noted in .agent-notes/nan-edge-endpoint-diagnosis.md).
  #1949's Δ144 detour-side flat residual is pre-existing and out of scope.
