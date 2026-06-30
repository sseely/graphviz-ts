<!-- SPDX-License-Identifier: EPL-2.0 -->
# T5 — Regenerate parity + 0-regression check + finalize

## Context
Measure the improvement, prove 0 regressions, finalize the mission record.
Mirrors the arrowhead-geometry mission's T8.

## Task
1. **BEFORE map:** copy the current `test/corpus/parity.json` to
   `/tmp/parity-before-errcluster.json` (baseline: byte 249, structural 222,
   errored 13).
2. **Regenerate:** `npx tsx test/corpus/survey.ts` then
   `npx tsx test/corpus/dashboard.ts` (env defaults match this machine; the
   survey takes a few minutes — run it backgrounded and wait).
3. **Regression check (HARD GATE):** per-id verdict diff BEFORE vs AFTER. Rank
   verdicts (byte>structural>diverged>errored/timeout>oracle-error); ANY drop
   caused by the change → STOP and investigate. oracle-error transitions are
   noise. Use the ranked-diff script pattern from the arrowhead mission.
4. **Tally:** confirm the 8 target cases (121, 2239, 258, 1332, graphs-b53, 1767,
   graphs-big, graphs-biglabel) moved off `errored`; record each id's
   before→after verdict.
5. **ADR-4 audit:** for any fixed case that landed `diverged` (not byte/
   structural), record its new first-diff path + one-line reason in the journal
   (the crash is resolved; residual is an unrelated axis).
6. **Finalize:** append the mission summary to `decision-journal.md`; add a
   project-memory note (`~/.claude/projects/.../memory/`) with the parity delta +
   the 4 root-cause fixes, and add the MEMORY.md index pointer.

## Write-set
- `test/corpus/parity.json`, `test/corpus/PARITY.md` (regenerated)
- `plans/errored-cluster/decision-journal.md` (append)
- `~/.claude/projects/-Users-scottseely-git-graphviz-ts/memory/` (new note +
  MEMORY.md pointer)

## Read-set
- `test/corpus/survey.ts`, `test/corpus/dashboard.ts` (run them)
- decisions.md#adr-4, #adr-5

## Acceptance criteria
- Given regeneration, then `errored` ≤ 13 − (cases fixed); conformant and
  structural ≥ baseline (249 / 222).
- Given the per-id diff, then **0 regressions** (every changed verdict is an
  improvement; oracle-error excluded).
- Given the 8 target cases, then each is off `errored`; any still-`diverged` case
  has its new first-diff recorded.
- Given `npm test`, then green.

## Observability / Rollback
N/A. Reversible (regenerated artifacts + docs).

## Quality bar
`npm run typecheck && npm test && npm run build` exit 0. One commit:
`test(corpus): regenerate parity after errored-cluster fixes (T5)`.

## Boundaries
- Refs/verdicts come from the native oracle + survey only — never hand-edit
  `parity.json`/`PARITY.md`.
