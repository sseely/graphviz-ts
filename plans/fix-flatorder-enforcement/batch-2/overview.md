# Batch 2 — Validate + baseline refresh

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2 | Final full survey; assert 0 regressions and which of the still-diverged `ordering` graphs now match; document any secondary-cause residuals; refresh the parity baseline | debugger | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md` | T1 | [ ] |

Execution rule: run the full survey + rules-gate. Confirm GATE PASS, 0 regressions.
Record how many of the targeted `ordering` graphs (b58, ordering_dot1×3, pgram×3,
trapeziumlr×3, 1472) are cleared (in-rank order now == C) and, per AD-5, document any
that remain diverged for a FURTHER secondary cause (which graph, which cause — x-NS,
spline, etc.) in the decision journal; do NOT chase those here. Then refresh the
baseline:
`cp test/corpus/parity-probe.json test/corpus/parity-rules.json && cp test/corpus/parity-probe.json test/corpus/parity.json && npx tsx test/corpus/dashboard.ts`.

Registry hygiene: cleared graphs leave the tracked-gap backlog automatically via the
refresh; a residual that becomes a NEW documented accepted delta is a SEPARATE
decision (default: leave in the tracked backlog, not accepted).

Batch done = GATE PASS + baseline refreshed + decision journal records the per-graph
outcome.
