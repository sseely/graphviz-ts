# T2 — Localize the exact ns.c deviation

## Context

T1 confirmed the x-coord network simplex cycles (does not converge) on 2471's
correct-order aux graph where C converges. This task pins the exact deviation
from `ns.c`. Investigative — run inline so harness/oracle state persists.
Hard-gated: 2 diagnostic rounds.

## Task

Compare TS vs C at a pinned pivot point to localize the deviation among the
network-simplex primitives:
- **`leaveEdge`** (ns.ts) — the rotating `Search_size` index / negative-cut-value
  selection. C `leave_edge` uses a rotating start (`S_i`) for anti-cycling.
- **`enterEdge`** (ns.ts) — entering-edge selection (min-slack across the cut).
- **`nsUpdate` / `exchangeTreeEdges`** (ns.ts / ns-core.ts) — the pivot:
  cut-value delta, `invalidatePath`, low/lim postorder re-walk.
- **cut-value / low-lim maintenance** (ns-core.ts) — stale cut values or low/lim
  ranges cause `leaveEdge` to re-select the same edge forever.

Method: instrument both sides to dump the first N pivots (leave edge, enter
edge, cut values touched, low/lim of affected subtree); find the first pivot
where TS and C diverge; trace that primitive's C-vs-TS behavior.

## Write-set

- `batch-2/ns-root-cause.md` — root-cause doc (function + C-vs-TS diff + fix).
- Temporary probes in `ns.ts`/`ns-core.ts` and C `ns.c` (all reverted).

## Read-set

- `src/layout/dot/ns.ts` — `leaveEdge`, `enterEdge`, `nsUpdate`, `feasibleTree`
- `src/layout/dot/ns-core.ts` — `addTreeEdge`, `invalidatePath`,
  `exchangeTreeEdges`, cut-value helpers
- C: `~/git/graphviz/lib/common/ns.c` — `leave_edge`, `enter_edge`, `update`,
  `dfs_cutval`, `dfs_range`, `treesearch` / `Search_size` handling
- `decisions.md#adr-1` (faithful-only), `#adr-5`

## Architecture decisions (locked)

ADR-1 (faithful-only — the fix must match C, no heuristic), ADR-5.

## Interface contract (consumed by T3)

`ns-root-cause.md` must state, minimally:
- `function`: exact TS symbol + file (e.g. `ns.ts:leaveEdge`)
- `cDiff`: one-paragraph precise C-vs-TS behavioral difference, with `ns.c`
  line anchors
- `fix`: the proposed faithful change (code sketch), as `faithful-fix.md` does

## Acceptance criteria

- Given a pinned diverging pivot, when TS and C selections/cut-values are
  compared, then the doc names the exact function + the precise difference.
- Given the root cause, when documented, then it includes a concrete proposed
  faithful fix referencing `ns.c` lines.
- Given 2 diagnostic rounds without a single localized deviation, when the
  budget is exhausted, then STOP, document what's known, leave tree reverted.

## Observability

N/A — temporary probes only, reverted.

## Rollback

Reversible — no committed source; C instrumentation reverted (sacred).
