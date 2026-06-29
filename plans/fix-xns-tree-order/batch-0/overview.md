<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 0 — Diagnose the exact add-order divergence

Read-only instrumentation. No port code changes. Output is a precise finding that
sets Batch 1's write-set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T0 | Pin first `addTreeEdge` order divergence + the C rule that causes it | (inline/opus) | `.agent-notes/` only | — | [ ] |

Depends on nothing. Batch 1 cannot start until T0 names the exact divergent
subtree-merge decision and the C tie-break to replicate.

Spec: `T0-diagnose-add-order.md`.
