<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Stage-1 truth pass ∥ diagnosis

Two independent tasks, disjoint write-sets, run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | §A2 doc truth pass + honest JSON reasons (Stage 1) | main session or sonnet | `docs/known-divergences.md`, `test/corpus/accepted-divergences.json` | — | [x] |
| T2 | Diagnose the 8-edge NaN residual (C-first differential dumps) | main session (opus) | `.agent-notes/nan-edge-endpoint-diagnosis.md`, `decision-journal.md`, temp C instrumentation (reverted) | — | [x] |

Gate after batch: `npx tsc --noEmit`, `npx vitest run` (guard test), no
verdict churn (T1 changes no verdict inputs; T2 changes no src). One commit
per task.
