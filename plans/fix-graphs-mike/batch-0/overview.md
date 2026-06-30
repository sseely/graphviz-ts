<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 0 — Diagnose the L→U routing divergence

Read-only instrumentation. No port logic changes. Output is a precise finding
that pins Batch 1's write-set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T0 | Pin why port routes L→U as 14 pts vs C's 8; name the exact fix locus | (inline/opus) | `.agent-notes/` only | — | [x] |

Batch 1 cannot start until T0 names the divergent routing decision (box corridor
construction, virtual-node chain span, recover_slack order, or fitter piece
count) and the C rule to replicate.

Spec: `T0-diagnose.md`.
