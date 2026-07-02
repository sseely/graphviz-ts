<!-- SPDX-License-Identifier: EPL-2.0 -->
# T5 — Full survey, Stage-2 retire, merge

## Context
Batches 1(-2) landed. The A2 disposition now follows decisions.md#d1 based on
T2's classification and (if run) T3/T4's result.

## Task
1. Confirm C tree pristine + oracle byte-verified (T2 acceptance already
   requires this; re-check).
2. Full survey: `GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json TSX_BIN=<tsx>
   $TSX_BIN test/corpus/survey.ts`; then `$TSX_BIN test/corpus/rules-gate.ts`
   vs COMMITTED HEAD parity. 0 regressions; investigate every maxDelta mover
   (per-element compare where childCount masks; oracle-crash graphs like 2825
   are known noise — verify port bytes unchanged before dismissing).
3. Stage-2 `accepted-divergences.json` + `docs/known-divergences.md` per the
   D1 outcome:
   - conformant → remove the 3 entries; §A2 becomes a closed/historical
     section (guard test enforces removal).
   - irreducible → replace entries' class/reason with the new evidence-backed
     classification; §A2 retires, new section documents the real class.
   - fix-out-of-scope → remove entries (ids become tracked); §A2 retires;
     follow-up mission stub noted in the journal.
4. `cp test/corpus/parity-rules.json test/corpus/parity.json`;
   `$TSX_BIN test/corpus/dashboard.ts` → PARITY.md.
5. Mission summary at the bottom of README.md (tasks done vs planned,
   decisions count, gate results, follow-ups); final journal rows; update
   project memory if a durable lesson emerged.
6. Merge `fix/nan-a2-retire` → `main` with a **merge commit**. Do NOT delete
   the branch (cleanup is batched).

## Write-set
`test/corpus/{accepted-divergences.json, parity.json, parity-rules.json,
PARITY.md}`, `docs/known-divergences.md`, `plans/fix-nan-a2-retire/**`.

## Acceptance criteria
- Given the survey, when rules-gate runs, then exit 0 and 0 regressions.
- Given the D1 outcome, when the guard test runs post-edit, then PASS (and
  for the conformant path: the 3 ids report `conformant` in parity.json).
- Given PARITY.md, when regenerated, then the accepted-deltas table reflects
  the Stage-2 state (no A2 rows, or the new class's rows).

## Observability / Rollback
Survey + gates are the observability. Reversible (branch merge revert).

## Commit(s)
`chore(a2): refresh parity + retire A2 per D1 outcome` + merge commit
`Merge fix/nan-a2-retire: <outcome one-liner>`.
