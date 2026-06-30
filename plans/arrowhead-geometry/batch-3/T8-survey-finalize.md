# T8 — Regenerate parity + 0-regression check + finalize

## Context
Measure the improvement and prove 0 regressions, then finalize the mission record.

## Task
1. **BEFORE map:** read the current `test/corpus/parity.json` (baseline:
   conformant 245) and save per-id verdicts to `/tmp/parity-before-arrow.json`.
2. **Regenerate:** `npx tsx test/corpus/survey.ts` then
   `npx tsx test/corpus/dashboard.ts` (env defaults match this machine).
3. **Regression check (HARD GATE):** per-id verdict diff BEFORE vs AFTER. Rank
   verdicts; ANY drop (byte→structural/diverged, structural→diverged,
   anything→errored/timeout caused by the change) → STOP and investigate.
   oracle-error transitions are noise.
4. **Tally:** conformant delta; confirm the 16 target cases improved (record each
   id's before→after verdict).
5. **Deferred audit:** if any target case is still deep (residual layout diff,
   not arrow geometry), update its `comparisons/<id>.md` with the new first-diff +
   reason; reference in the journal.
6. **Finalize:** append the mission summary to `decision-journal.md`; update
   project memory (`~/.claude/projects/.../memory/`) with the parity delta + the
   arrow-geometry port, and add the MEMORY.md index pointer.

## Write-set
- `test/corpus/parity.json`, `test/corpus/PARITY.md` (regenerated)
- `plans/arrowhead-geometry/decision-journal.md` (append)
- `~/.claude/projects/-Users-scottseely-git-graphviz-ts/memory/` (new note +
  MEMORY.md pointer)

## Read-set
- `test/corpus/survey.ts`, `test/corpus/dashboard.ts` (run them)
- decisions.md#adr-6

## Acceptance criteria
- Given regeneration, then conformant > 245 (the baseline).
- Given the per-id diff, then **0 regressions** (every changed verdict is an
  improvement).
- Given the 16 target cases, then each improved (diverged → structural or
  conformant); any still-deep case has an updated comparison page.
- Given `npm test`, then green.

## Observability / Rollback
N/A. Reversible (regenerated artifacts + docs).

## Quality bar
`npm run typecheck && npm test && npm run build` exit 0. One commit:
`test(corpus): regenerate parity after arrowhead-geometry port (T8)`.
