<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — diagnosis

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Diagnose the 5-edge 1332 routing divergence (C-first differential dumps) | main session | `.agent-notes/1332-edge-routing-diagnosis.md`, `decision-journal.md`, temp C instrumentation (reverted) | — | [x] |

Gate after batch: `npx tsc --noEmit`, `npx vitest run` (T1 changes no src),
C tree clean + oracle byte-verified. One commit.
