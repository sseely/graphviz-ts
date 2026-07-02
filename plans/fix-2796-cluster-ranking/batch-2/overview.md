<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — CONDITIONAL: fix the input defect + watch gate

**Entry condition:** T1 verdict = INPUTS-DIVERGE. If INPUTS-MATCH, skip
this batch entirely (journal the skip) and go to Batch 3.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | Faithful fix of the constraint-input defect at its origin + regression tests | main session | PROVISIONAL: `src/layout/dot/{rank*.ts, cluster.ts, ns.ts}` + matching `.test.ts` — expansion via interactive ask, driven by T1 `fixLocus` | T1 | [ ] |
| T4 | Watch-graph gate | main session | `.agent-notes/`, `decision-journal.md` only | T2 | [ ] |

The gate for T2 is INPUTS-MATCH after the fix — NOT any layout target on
2796 (the oracle's recovery layout is not a target, D1). Expect the fix to
potentially move OTHER cluster graphs (2471/2475_2/b51 family) — toward the
oracle only. One commit per mechanism.
