# Batch 2 — Validate + baseline refresh

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2 | Final full survey; assert 0 regressions and which of the 13 `ordering` graphs now match; document any secondary-cause residuals; refresh the parity baseline | debugger | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md` | T1 | [x] |

**T2 outcome:** Survey GATE PASS, **0 regressions / 0 clip-regressions**. Of the ~13
diverged `ordering` graphs, **1 cleared**: `graphs-in` (structural-match → conformant;
overall conformant 492→493). The headline reproducer `b58` has its in-rank order
corrected for nodes 1,2,4,5,7 (node 7 now places 5 left of 4, matching C) but stays
`diverged` on a **secondary cause** (nodes 3/6/8). Per AD-5 this residual is documented,
not chased:

> **Secondary cause (separate mission):** C enforces FLATORDER constraints via
> `build_ranks` BFS install order — its FLATORDER edges are weight-0 (calloc default
> from `new_virtual_edge(…, NULL)`) and are skipped by both `constraining_flat_edge`
> and `flat_search` (mincross.c:1093). The port enforces FLATORDER through
> **weight-1 `flat_reorder`/`flat_search`** instead; an experiment setting the port's
> FLATORDER weight to 0 made b58 worse (8→12 diverged, broke the node-7 fix),
> proving the two enforcement models differ. Same cause keeps `ordering_dot1`×3,
> `pgram`×3, `trapeziumlr`×3, and `1472` diverged. Reconciling the port's
> flat-enforcement model to C's is out of scope for this mission.

Baseline refreshed: `parity-probe.json` → `parity-rules.json` + `parity.json`;
`PARITY.md` regenerated (conformant 493). The residual `ordering` graphs remain in
the tracked-gap backlog (NOT promoted to accepted deltas) per the Batch-2 hygiene rule.

Execution rule: run the full survey + rules-gate. Confirm GATE PASS, 0
regressions. Record how many of the 13 diverged `ordering` graphs are cleared
(in-rank order now == C) and, per AD-5, document any that remain diverged for a
SECONDARY cause (which graph, which cause — x-NS, spline, etc.) in the decision
journal; do NOT chase those here. Then refresh the baseline:
`cp parity-probe.json parity-rules.json && cp parity-probe.json parity.json && npx tsx test/corpus/dashboard.ts`.

Also (registry hygiene): if any cleared graph was the reason for a stale entry, no
action needed; if a residual graph is a NEW documented accepted delta, that is a
SEPARATE decision — default is to leave it in the tracked backlog, not accept it.

Batch done = GATE PASS + baseline refreshed + decision journal records the
per-graph outcome.
