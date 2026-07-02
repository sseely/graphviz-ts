<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions (pre-made, user-approved 2026-07-01)

## D1 — Truth-first done criteria (outcome ladder)

The primary deliverable is the **mechanism** of the 8-edge residual, not a
particular verdict. Ranked outcomes:

1. **Port defect, fixed faithfully** → NaN family conformant on all 3 corpus
   dirs → remove the 3 A2 entries from `accepted-divergences.json` (the CI
   guard *requires* removal once conformant).
2. **Root cause proven irreducible** (FP/libm-class; requires a controlled
   experiment isolating the variable, not an assertion) → ids stay accepted
   under a NEW honest class/reason + evidence link; A2-as-text-measurement
   still retires.
3. **Port defect, fix exceeds scope** (write-set expansion denied or fix
   intractable per stop rules) → remove the stale A2 entries; ids move to
   *tracked* structural-match; pinned mechanism documented for a follow-up
   mission.

"Count/verdict forced without a mechanism" is not an outcome.

## D2 — Two-stage doc/JSON cleanup

- **Stage 1 (unconditional, T1):** rewrite `docs/known-divergences.md` §A2 to
  measured reality; re-word the 3 JSON entry `reason` fields to the honest
  "edge-endpoint residual, nodes exact, under re-diagnosis". IDs remain
  accepted → zero verdict churn, guard test and rules-gate unaffected.
- **Stage 2 (fix-dependent, T5):** retire/move/reclassify entries per D1's
  outcome.

Rationale: the doc is provably wrong today (stale FreeType-as-current table,
non-corpus proc3d figures); correcting it must not be hostage to the fix.

## D3 — Diagnosis method: C-first differential instrumentation

Env-gated dumps in the C oracle (pathend boxes, beginpath/endpath port points,
clip parameters for the 4 edge pairs) mirrored by TS dumps; diff line-wise —
the recipe that resolved b15. The doc's three candidates (boundary clip-point
drift from approach angle; residual port metric; compress x-simplex tie) are
directly distinguishable this way. The forced-inputs seam experiment (feed C's
values at the TS seam) is the *confirmation* tool once a candidate is pinned,
and the required proof for any "irreducible" claim.

## Write-set expansion protocol (user-added constraint)

T3's write-set is **provisional until T2 pins the mechanism**. If `fixLocus`
(T2's output) or a mid-implementation discovery lands outside the declared
write-set: STOP before editing, present implicated `file:line` + mechanism
artifact, request expansion. Approved expansions are appended to the task's
write-set table and journaled.

## Operational notes (Phase 4, confirmed)

- Rollback class: **Reversible** (local branch; revert-only).
- SLIs: survey verdicts + rules-gate vs committed HEAD; NaN per-element gate
  (nodes 0 / edges 8→0). compareSvg maxDelta alone is NOT trusted across
  element-count changes (childCount descent blindness — see
  `.agent-notes/b15-per-entry-run-routing.md`).
- Budget: ≤2 full survey runs (Stage 1 needs none; Stage 2 one, +1 only after
  a gate fix).
- C tree: instrument → revert → rebuild → byte-verify oracle before survey.
- Scope holds: A3 (`2368`), `R-oracle`, `R-xns` entries untouched.
