<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Gated diagnosis (no src/ edits)

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Root-cause the 2 lost edges (a->b, o->r) | main loop | .agent-notes/2183-lost-edges.md, journal | — | [ ] |
| T2 | Root-cause the 3 missing cluster labels | main loop | .agent-notes/2183-cluster-labels.md, journal | — | [ ] |
| T3 | Attribute numeric deltas (maxΔ 248) per D3 | main loop | journal | T1, T2 | [ ] |

GATE: report all mechanisms (cause, origin file:line, causal chain,
ruled-out) in the journal + agent notes before Batch 2. Temporary C
instrumentation must end reverted + rebuilt + oracle byte-verified.
