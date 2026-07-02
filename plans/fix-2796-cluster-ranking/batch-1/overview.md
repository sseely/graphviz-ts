<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — verify NS constraint inputs vs C

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Verify the cluster-ranking constraint graph fed to NS matches C's (one instrumentation round); state the verdict with evidence | main session | `.agent-notes/2796-ns-inputs-verification.md`, `decision-journal.md`, temp C+TS instrumentation (reverted) | — | [x] |

Gate after batch: `npx tsc --noEmit`, `npx vitest run` (T1 changes no src),
C tree clean + oracle stdout byte-verified (exit 1 is its normal state).
One commit.
