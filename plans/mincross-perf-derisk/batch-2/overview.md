<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 2 — Execute the findings

Runs after Batch 1's `findings.md` verdict. Auto-proceeds if the fix is
byte-safe and within the permitted write-set (human pre-authorized); otherwise
the ask-gate (AD-4) or a STOP condition fires.

| ID | Description | Writes | Depends On | Done |
|---|---|---|---|---|
| X1 | Implement the AD-2 fix the verdict names (iteration-count faithfulness fix OR per-op optimization of `reorderInner`/`accumCross`), with a unit test locking the behavior | `src/layout/dot/mincross*.ts` (+ `*.test.ts`); **other files only after an AD-4 permission ask** | D3 | [x] |
| X2 | Validate: full survey 0 regressions + byte-identity; re-time 2108/b100/b104/1718; update `comparisons/` page + decision journal | `plans/mincross-perf-derisk/comparisons/*.md`, `decision-journal.md` | X1 | [x] |

## X1 notes

- The fix shape is determined by `findings.md`, not guessed here. Two templates:
  - **Iteration-count**: make the port's `ncross()` / convergence test /
    crossing tiebreak match C exactly so the pass count collapses to C's. Add a
    test that pins per-pass crossing counts (or pass count) on a small fixture
    to C's values.
  - **Per-op**: optimize the named hot loop (data structure, hoisted reads, no
    per-iter allocation) leaving iteration count unchanged. Add a test that the
    optimized function returns identical results to the prior form on fixtures.
- **AD-4 ask-gate**: if the fix needs a file outside `mincross*.ts`, STOP and
  ask before editing it.

## X2 notes

- The survey gate is the exit gate: conformant ≥ 312, structural ≥ 256, **0
  changed per-id verdicts** vs `parity-baseline.json`. A mincross change that
  alters node order would ripple into positions → verdict changes = regression.
- Re-time 2108 (primary) + b100/b104/1718; log C-vs-port before/after in the
  journal and the comparison page. If the iteration-count fix lands, expect a
  large 2108 drop; if per-op, a smaller constant-factor drop.

## Quality gate

All gates in `../README.md#quality-gates`. Mission complete when: 0 regressions,
2108 re-timed and logged, and the `comparisons/` page records the outcome
(rescued → which verdict; or still-timeout with the new number + reason),
referenced from the decision journal.
