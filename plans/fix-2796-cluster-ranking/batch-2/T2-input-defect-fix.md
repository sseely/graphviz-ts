<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Fix the constraint-input defect (CONDITIONAL)

## Entry condition
T1 verdict = INPUTS-DIVERGE only.

## Context
T1 pinned a mechanism where the port's cluster-ranking constraint graph
departs from C's. Fix it faithfully at the origin (cite `@see` C
file:line). The gate is INPUTS-MATCH on re-dump — 2796's final layout is
NOT a target (D1: the oracle's is recovery-state debris). If the faithful
inputs make the port's NS hit C's infeasibility, do NOT port the recovery
semantics — stop and journal (that outcome feeds Batch 3's disposition
wording; the survey decides what verdicts do).

## Task
1. Read `.agent-notes/2796-ns-inputs-verification.md`. fixLocus ⊄ write-set
   → interactive expansion ask first.
2. Faithful fix at the origin; no 2796 special cases.
3. Mechanism-capturing test (fix-sensitive; red/green verified by stash) —
   or journaled corpus-gate fallback after ~3 minimization attempts.
4. Gate: re-dump inputs both sides → MATCH; tsc/vitest/goldens green;
   lizard caps hold.

## Write-set (PROVISIONAL — expansion via interactive ask)
`src/layout/dot/rank*.ts`, `src/layout/dot/cluster.ts`,
`src/layout/dot/ns.ts` + matching `.test.ts`.

## Acceptance criteria
- Given the fix, when inputs are re-dumped, then C and TS match (mod
  naming) with the diff attached.
- Given the diff, then changes trace to the mechanism origin.
- Given tsc / vitest / goldens, then 0 / pass / pass.

## Observability / Rollback
N/A. Reversible.

## Commit
`fix(dot): <mechanism, one line> — cluster-ranking constraint inputs`
