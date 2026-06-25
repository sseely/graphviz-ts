<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 0 — Investigation / order-pinning (GATES Batch 1)

Sequential (each task consumes the prior's output). **No `src/` edits** — only C
instrumentation, throwaway port dumps, and analysis docs under `comparisons/`.
Batch 1 may not start until T0.3 records a GO.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T0.1 | Instrument C `dot_splines_` (dispatch call site + `recover_slack`); capture the exact `edgecmp` dispatch order + per-edge order-sensitive reads (recover_slack moves; which neighbors have splines) for `ldbxtried` `n0->n1`/`n0->n2` + a minimal repro | opus | `comparisons/c-order-oracle.md` | — | [ ] |
| T0.2 | Instrument the PORT's two-pass order (`dotSplines_` group loop + `routeDotEdges`); side-by-side vs C; VERIFY the port's `edgecmp` reproduces C's order (ADR-5 containment check) | opus | `comparisons/port-vs-c-order.md` | T0.1 | [ ] |
| T0.3 | Pin root cause; confirm Option A unified pass is contained to `splines.ts`/`edge-route.ts` (+ at most trivial `edge-order.ts` align); write GO/STOP + refined Batch-1 split | opus | `comparisons/root-cause.md`, `decision-journal.md` | T0.2 | [ ] |

## Quality gates (after T0.3)
```
- command: test -f plans/fix-edge-route-order/comparisons/root-cause.md
  pass: file exists and records GO or STOP with evidence
  on_fail: stop
- gate: T0.3 decision == GO  (else STOP per ADR-5, re-plan)
- gate: port edgecmp reproduces C order  (else STOP)
```

## Write-set conflict check
T0.1/T0.2/T0.3 write distinct docs. C instrumentation lives in `~/git/graphviz`
(outside this repo). Clean. No `src/` writes in Batch 0.
