# TF.1 — Consolidate registry, regenerate docs, full sweep

## Context
Batches 1-3 landed fixes and left accept proposals in their `batch-N/findings.md`.
This task consolidates the accepts into the registry, regenerates the parity
artifacts, and proves the mission with one fresh sweep.

## Task
1. Add an `fdp` block to `test/corpus/accepted-divergences-engines.json`: an
   `A1-drift` class entry (`{ class: true, attributionFile: "attribution-fdp.json",
   ref: "known-divergences.md#a1-drift-iterative-engines" }`) plus each per-id
   A9/other accept from `batch-{1..3}/findings.md` (shape the accept test
   validates: `{ class, bound?, ref }`; id must be in corpus-manifest.json;
   ref truthy).
2. Add fdp accept rationale to `docs/known-divergences.md` (reuse/extend the
   `#a9-sfdp-fp-ties` anchor or add `#a9-fdp-fp-ties`; class members need a `ref`).
3. Regenerate `attribution-fdp.jsonl` once more if any fix moved ids. Run a FRESH
   fdp engine-walk to a scratch jsonl (no competing renders); if a fix touched a
   shared primitive, re-walk every affected engine. Then
   `npx tsx test/corpus/parity-report.ts`.
4. Verify 0 `pass->diverged` on fdp (and any re-swept engine) vs the T0.2
   baseline snapshot, and that fdp tracked count dropped to 0 (diverged −
   drift-exonerated − per-id accepts).
5. Append a mission-summary row to this mission's `decision-journal.md` AND the
   root `plans/decision-journal.md`: tracked before/after, fixes landed, accepts
   added (with classes), sweep result, cross-engine isolation proof.
6. Merge the branch to main (merge-commit per commits.md; preserve per-task commits).

## Read-set
- `batch-{1..3}/findings.md` (accept proposals + which engines to re-sweep)
- `test/corpus/accepted-divergences-engines.test.ts` (registry shape + validator)
- `test/corpus/parity-report.ts`, `test/corpus/engine-walk.ts`
- the sfdp finalize precedent (`plans/sfdp-tracked-divergences/batch-6/`)

## Write-set
- `test/corpus/accepted-divergences-engines.json` (SOLE writer)
- `test/corpus/parity-*.{json,jsonl}` (re-swept engines), `test/corpus/attribution-fdp.jsonl`
- `test/corpus/PARITY*.md`, `docs/known-divergences.md`
- `plans/fdp-tracked-divergences/decision-journal.md`, `plans/decision-journal.md`

## Acceptance criteria
- Given all accept proposals, when added, then
  `accepted-divergences-engines.test.ts` passes and every per-id accept has an
  evidence ref (ADR-3).
- Given the fresh sweep, when diffed vs baseline, then 0 `pass->diverged` on fdp
  and every re-swept engine.
- Given PARITY-fdp.md, when read, then tracked = diverged − drift-exonerated −
  per-id accepts, and that number is 0.
- Given `npx tsc --noEmit` and `npm test`, when run, then both are clean/green.

## Observability / rollback
N/A. Reversible.

## Boundaries
- Stop if the sweep shows ANY `pass->diverged` on any engine — bisect to the
  offending bucket's fix before finalizing.
- `pgrep` before every sweep; scratch jsonls only; never resume; no competing
  renders during a verification sweep.

## Commit
`docs(TF.1): finalize fdp tracked-divergence mission (registry + parity docs)`
then merge-commit the branch to main.
