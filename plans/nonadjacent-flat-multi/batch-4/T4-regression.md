# T4 — Full-corpus regression sweep + mission close

## Context
T2/T3 added + wired the faithful cnt≥2 non-adjacent flat router. The change is in the
SHARED non-adjacent flat path; cnt=1 is byte-identical by construction (AD-1), but
that must be PROVEN across the corpus. READ `../decisions.md` (AD-1, AD-5),
`../findings-diagnosis.md`, memory `bucket-fix-rebucketing`.

## Task
1. **Curated goldens:** `npx vitest run`. Expect 0 failures, every golden
   BYTE-IDENTICAL (no flat-edge corpus case is cnt≥2, so nothing should move). The new
   synthetic cnt≥2 tests pass. ANY out-of-family flip ⇒ STOP.
2. **Corpus survey (the gate):** back up the current `test/corpus/parity.json`, run
   `npx tsx test/corpus/survey.ts`, diff per-id vs the backup:
   - ZERO new `diverged`/`structural-match` (regression) verdicts. (Ignore
     `errored↔timeout` flips on already-failing ids — verify each was already failing.)
   - All 74 cnt=1 non-adjacent flats unchanged (spot-check 241_0, 1->6, plus a sample).
   - Record the per-id delta table (expect: empty / no changes, since no corpus input
     is cnt≥2). Any genuine new diverge ⇒ STOP.
3. **End-to-end confirm:** `render-one.ts` synthetic cnt=2/cnt=3/bottom byte-match
   native `dot` (re-capture the oracle fresh); cnt=1 synthetic unchanged.
4. **Restore native oracle (AD-5):** no instrumented plugin in `/tmp/gvplugins`;
   `git -C ~/git/graphviz status` clean; a `CPROBE=1`/`FLATPROBE=1` render emits 0
   markers (if any C instrumentation was used in T2).
5. **Close:** update memory `flat-edge-241-is-y-only` latent-follow-up note to mark
   the cnt≥2 gap CLOSED (cite the synthetic byte-match + zero corpus impact); write the
   mission summary in `README.md`; merge `fix/nonadjacent-flat-multi` → `main` with a
   merge commit (preserve per-task IDs).

## Write-set
- `plans/nonadjacent-flat-multi/findings-regression.md` (Create) — per-id delta,
  synthetic byte-match before/after, oracle restore note.
- `test/corpus/parity.json` — only if any verdict legitimately changed (expected: none).
- memory `flat-edge-241-is-y-only.md` + `MEMORY.md` (close the latent note).

## Read-set
- `../decisions.md` (AD-1, AD-5); `test/corpus/parity.json`, `survey.ts`,
  `render-one.ts`; memory `bucket-fix-rebucketing`, `oracle-native-not-wasm`

## Acceptance criteria
- `vitest` 0 failures; goldens byte-identical out-of-family; synthetic cnt≥2 tests pass.
- `survey.ts`: ZERO new diverges/regressions; 74 cnt=1 flats unchanged; per-id delta
  recorded.
- Synthetic cnt=2/cnt=3/bottom byte-match native end-to-end.
- C oracle restored native; memory + summary updated.

## Observability / Rollback
N/A offline lib. Reversible (revert merge).

## Commit
`test(flat): cnt>=2 non-adjacent flat regression sweep — 0 new diverges`
Mission close: merge commit `merge: faithful cnt>=2 non-adjacent flat routing`.
