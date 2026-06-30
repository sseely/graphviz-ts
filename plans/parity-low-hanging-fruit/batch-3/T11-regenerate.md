# T11 — Regenerate parity + finalize

## Context
All Batch 2 fixes are merged. Regenerate the corpus parity survey to measure the
improvement and prove 0 regressions, then finalize the mission record.

## Task
1. **Capture BEFORE:** read `test/corpus/parity.json` `counts` and the per-id
   verdict map (id → verdict) from the pre-fix state (git: the parity.json on the
   merge base). Save the per-id map for the regression diff.
2. **Regenerate:** run `npx tsx test/corpus/survey.ts` then
   `npx tsx test/corpus/dashboard.ts` (oracle env per README: `DOT_BIN`,
   `GVBINDIR=/tmp/gvplugins`, `CORPUS_ROOT=~/git/graphviz/tests`). This rewrites
   `parity.json` + `PARITY.md`.
3. **Regression check (HARD GATE):** diff per-id verdicts BEFORE vs AFTER. Allowed
   transitions: diverged/errored → structural/conformant, structural → conformant.
   ANY regression (byte→structural, structural→diverged, anything→errored/timeout
   that the fix could have caused) → STOP and investigate. Treat new timeouts as
   noise ONLY if the case still renders within a manual re-run; otherwise flag.
4. **Tally:** record conformant delta and the count of promoted cases per bucket.
5. **Deferred-case audit:** confirm every case marked `deep` in the triage docs
   has a `comparisons/<id>.md` page; reference them in the decision journal
   (CLAUDE.md completeness gate).
6. **Memory + journal:** append the final summary to `decision-journal.md`; update
   project memory with the parity delta and the fixes landed.

## Write-set
- `test/corpus/parity.json`, `test/corpus/PARITY.md` (regenerated)
- `plans/parity-low-hanging-fruit/decision-journal.md` (append)
- project memory under `.claude/projects/.../memory/` (append/update)

## Acceptance criteria
- Given regeneration, when complete, then conformant count > the pre-fix baseline.
- Given the per-id diff, then there are **0 regressions** (every changed verdict
  is an improvement).
- Given the triage docs, then every `deep` case has a referenced comparison page.
- Given the suite, then `npm test` is green.

## Observability / Rollback
N/A. Reversible (regenerated artifacts + docs).

## Quality bar
`npm run typecheck && npm test && npm run build` exit 0. Commit:
`test(corpus): regenerate parity after low-hanging-fruit fixes`.
