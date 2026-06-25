<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 0 — Investigation / oracle-pinning (GATES Batch 1)

Sequential (each task consumes the prior's output). **No `src/` edits** — only C
instrumentation, port instrumentation behind a throwaway branch/dump, and
analysis docs under `comparisons/`. Batch 1 may not start until T0.3 records a GO.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T0.1 | Instrument C `make_regular_edge`, rebuild `/tmp/gvplugins`; capture box list, per-edge offset ports, Pshortestpath polyline, bezier pt-counts for `ldbxtried` `n0->n2`(×3) + minimal repro | opus | `comparisons/c-oracle-dump.md` | — | [x] |
| T0.2 | Instrument the PORT dispatch (`routeParallelEdgeGroup`/`baseSplineForGroup`); capture base spline, shift offsets, per-edge result for the same inputs; side-by-side divergence | opus | `comparisons/port-vs-c-divergence.md` | T0.1 | [ ] |
| T0.3 | Pin root cause(s); confirm fix is contained to dispatch/route/box/straight-edges (NOT pathplan); write GO/STOP + refined Batch-1 task split | opus | `comparisons/root-cause.md`, `decision-journal.md` | T0.2 | [ ] |

## Quality gates (after T0.3)
```
- command: test -f plans/fix-parallel-corridor-route/comparisons/root-cause.md
  pass: file exists and records GO or STOP with evidence
  on_fail: stop
- gate: T0.3 decision == GO  (else STOP per ADR-5, re-plan)
```

## Write-set conflict check
T0.1/T0.2/T0.3 write distinct docs. C instrumentation lives in `~/git/graphviz`
(outside this repo). Clean. No `src/` writes in Batch 0.
