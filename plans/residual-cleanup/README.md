<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: residual cleanup (5 tracked ids + scoped-in 2620)

**Objective.** Drive the endgame's 5 residuals (1949, 1453, 2646, 2371,
1447_1 — plus 2620 scoped into the ortho family) to conformant or
documented-irreducible acceptance. Build on the fresh evidence in
[../structural-match-endgame/analysis/](../structural-match-endgame/analysis/)
— do not re-derive. Baseline snapshot: conformant 749, tracked 5 (396792c).

**Decisions.** Inherit [endgame decisions](../structural-match-endgame/decisions.md)
D1-D4 + amendments WHOLESALE (user-approved 2026-07-05): bounded pass before
acceptance; split diag→fix; diag agents worktree-isolated, docs returned as
final messages; one registry writer per batch; ask-to-expand write-sets;
per-batch survey gates on an idle box; maxΔ=0.0 timeout = standalone-verify,
not regression; NEVER rebuild the dot binary; revert C + rebuild /tmp/ghl
with byte-verification; checkpoint-first when resuming dropped agents.

**Quality gates per batch** (same as endgame README, incl. snapshot refresh
after pass): tsc → vitest → survey (idle, LPT) → rules-gate 0 regressions.

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — R1 check + R2-R5 diagnoses (parallel, docs-only) | [ ] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — R6-R10 outcomes (one registry writer: R6) | [ ] | [batch-2/overview.md](batch-2/overview.md) |
| 3 — R11 closeout | [ ] | [batch-3/overview.md](batch-3/overview.md) |

[decision-journal.md](decision-journal.md) · analysis/ (diag outputs) ·
[diagrams/component-map.md](diagrams/component-map.md)

Model routing: R4/R5 fable; rest sonnet; opus only if an outcome needs a
multi-path call. Rollback: everything Reversible (squash commits, registry
entries removable). Observability: SLIs = corpus metrics; dashboard = PARITY.md.
