# T4 — Implement the faithful fix

## Context
T3 pinned the first divergence between the port's and native's x-coord network
simplex (see `decision-journal.md`: `firstDivergence` = stage/file/function/cRef,
plus `minimalGraph` and `nativePivots`). Implement the faithful correction so the
port reproduces C's behavior at that point, which should collapse the port's pivot
count toward native's.

## Task
1. Read the T3 decision-journal entry: target file, function, and C reference.
2. Read the C reference and the port function side by side; identify the precise
   semantic difference (e.g. a missing aux-edge branch in `make_edge_pairs` /
   `make_LR_constraints`, a wrong `init_cutvalues` order, or a pivot tie-break).
3. **Write the regression test first (TDD):** assert the port's x-coord pivot
   count on the minimal fixture equals `nativePivots`. (Expose pivot count via a
   small test-only hook or by reusing the T2 probe behind a test-accessible flag;
   prefer a counter the test can read without env-var plumbing.)
4. Implement the minimal faithful fix in the pinned file. Do not touch unrelated
   code. Do not apply perf hacks that change results (ADR-4).
5. Confirm `npx tsc --noEmit` is clean.

## Write-set
- `<T3.firstDivergence.file>` (e.g. `src/layout/dot/position-aux.ts`).
- Its colocated test `<same>.test.ts` (create or extend).

If the fix genuinely needs a second file, confirm it is within this mission's
declared candidate set (`position-aux.ts`, `ns-subtree.ts`, `ns.ts`); if it needs
a file outside that set, STOP (README constraint).

## Read-set
- `decision-journal.md` (T3 entry) — the locked target + native pivot count.
- The pinned C reference (`~/git/graphviz/lib/...`).
- The pinned port function + its immediate helpers.
- decisions.md#adr-4.

## Architecture decisions (locked)
ADR-4 (faithful, not perf hack). The fix must be justified by a cited C
difference, noted in a code comment (`@see lib/.../<file>.c:<func>`).

## Interface contract
Input: T3's `{ minimalGraph, nativePivots, firstDivergence }`.
Output: the pinned file now produces C-equivalent behavior at that point.

## Acceptance criteria
- Given the minimal fixture, when rendered, then the port's x-coord pivot count
  equals `nativePivots` (the new test asserts this; it failed before the fix).
- Given the fix, when `npx tsc --noEmit` runs, then 0 errors.
- Given the fix, when the colocated test file runs, then it passes.
- The diff is confined to the pinned file + its test (plus the T3 fixture).

## Observability / Rollback
N/A. Reversible — single-commit revert.

## Quality bar
One commit: `fix(ns): <one-line cause> to match C x-coord NS pivots`. Body cites
the C reference and the before/after pivot count on the fixture.
