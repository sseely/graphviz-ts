# Batch 2 — Validate + baseline refresh

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2 | Final full survey; assert 0 regressions and which of the still-diverged `ordering` graphs now match; document any secondary-cause residuals; refresh the parity baseline | debugger | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md` | T1 | [x] |

**T2 outcome.** Survey GATE PASS, **0 regressions / 0 clip-regressions, 4
improvements** (run at Batch 1; no code changed since, so reused for the refresh).
Baseline refreshed: `parity-probe.json` → `parity-rules.json` + `parity.json`;
`PARITY.md` regenerated (conformant **493 → 496**). Verified the baseline diff is
EXACTLY the 4 expected verdict changes, no churn:

| Graph | Before | After | Cause |
|-------|--------|-------|-------|
| `graphs-b58` | diverged | structural-match | node order now == C; residual 0.24px flat `4->5` spline (AD-5 secondary) |
| `linux.x86-ordering_dot1` | diverged | conformant | fully fixed |
| `macosx-ordering_dot1` | diverged | conformant | fully fixed |
| `nshare-ordering_dot1` | diverged | conformant | fully fixed |

**Residuals (still diverged, SECONDARY cause — NOT FLATORDER, per AD-5 documented
not chased; left in tracked backlog, NOT accepted):** `{graphs,share,windows}-pgram`
(maxΔ 736–1108px), `{graphs,share,windows}-trapeziumlr` (maxΔ 690–931px), `1472`
(no coord Δ → structural/element-count diff). The large pixel deltas confirm a
different root cause (x-coord/spline/shape), unrelated to the flat-matrix index fix.
Canary `graphs-in` stays conformant.

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
