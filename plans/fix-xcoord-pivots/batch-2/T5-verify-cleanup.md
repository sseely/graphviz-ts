# T5 — Full verification + probe cleanup

## Context
With the fix in place (T4), verify it across the full test suite, the parity
survey (no regressions), and the `2475_2` end-to-end acceptance, then remove the
temporary Batch-1 probes so the shipped diff is clean.

## Task
1. **Remove temporary probes** added in T2 (the `// DEBUG-PROBE` env-gated lines in
   `ns.ts` / `position-aux.ts`). Probe scripts under `plans/.../probes/` may stay
   (gitignored). Keep any non-probe pivot-counter only if T4's committed test
   depends on it and it is clean, faithful code.
2. **Run gates:**
   - `npx tsc --noEmit` → 0 errors.
   - `npx vitest run` → all pass (≥2263).
   - `npx tsx test/corpus/survey.ts` then diff `parity.json` per-id vs the
     pre-mission baseline → **0 verdict regressions** (improvements OK).
     Regenerate `PARITY.md` via `npx tsx test/corpus/dashboard.ts`.
   - `2475_2` acceptance: x-coord pivots ≈ native (~8748) AND render < 20s
     (measure with the port timing bundle).
3. **Record results** in `decision-journal.md`: pivot count before/after on both
   the minimal fixture and 2475_2, render time, survey delta.

## Write-set
- `src/layout/dot/ns.ts`, `src/layout/dot/position-aux.ts` — remove probe lines
  (T4's fix stays).
- `plans/fix-xcoord-pivots/decision-journal.md` — results.
- `test/corpus/PARITY.md`, `test/corpus/parity.json` — regenerated.

## Read-set
- The pre-mission parity baseline (capture `parity.json` to `/tmp` before the
  survey re-run, or compare against git HEAD's version).
- README.md quality-gate table.

## Architecture decisions (locked)
ADR-4. A "pass" requires faithfulness evidence (pivot match + 0 verdict
regressions), not just a faster wall-clock.

## Interface contract
None downstream — final task.

## Acceptance criteria
- Given the fix, when `npx vitest run`, then all tests pass (≥2263).
- Given the survey, when diffed per-id vs baseline, then 0 verdict regressions.
- Given `2475_2`, when rendered, then x-coord pivots ≈ native (~8748) and render
  < 20s.
- Given `git diff`, when inspected, then no `// DEBUG-PROBE` lines remain in `src/`.

## Observability / Rollback
N/A. Reversible.

## Quality bar
Final commit (if separate from T4): `test(ns): pin x-coord pivot count + cleanup
probes`. Decision-journal closes with the before/after metrics table.
