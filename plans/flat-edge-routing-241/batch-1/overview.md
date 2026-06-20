# Batch 1 — diagnose flat-edge routing divergence

Read-only to `src/`. Single diagnosis task: instrument C `make_flat_edge` for
#241_0, dump the flat boxes + routed splines for the diverging edges, locate the
divergent port function.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Instrument C make_flat_edge/make_flat_bottom_edges for 241_0; dump flat boxes + routed spline for `3:sw->2:se` (straight-vs-curl), `1:se->6:sw` (y-offset), `5:ne->8:nw` (largest Δ); dump the port's; name the divergent fn + root cause | opus | `decision-journal.md` | — | [ ] |

## Interface (Batch 1 -> Batch 2)
T1 appends a journal row:
`{ divergentFn (file:line), cRef (C file:line), rootCause (1 line),
  exemplarEdges: ["3:sw->2:se", ...], sharedCause: bool }`.

## Diverging edges (from the post-compass-port survey, Δ up to 126)
- `3:sw->2:se` — port routes STRAIGHT (`M227.98,-2.98 ... 197.49,-2.98`); oracle
  CURLS below (`M228.98,-10.86 ... 0.37 ... -3.95`). Clearest exemplar.
- `1:se->6:sw` — long bottom edge; port at y=0, oracle at y=-7.88 (sets bbox
  bottom -> 7.88 global shift; cardinal `:e->:w` edges then all miss by 7.88).
- `5:ne->8:nw` — largest Δ=126; oracle curls UP, port routes very differently.

## Candidate divergent functions (confirm by instrumentation, do not assume)
- `src/layout/dot/splines-flat.ts`: `makeFlatEdge`, `topBoxes`/`bottomBoxes`,
  `makeFlatEndBox`, `makeFlatAdjEdges` — the flat box geometry & curl.
- C: `lib/dotgen/dotsplines.c:make_flat_edge`, `make_flat_bottom_edges`,
  `makeFlatEnd`, `makeBottomFlatEnd`.

## Stop conditions
Per README. AD-4: if the dump shows a deep multi-cause flat-routing divergence
(not an isolated box/curl branch) -> STOP, report, end.

## Quality gates
No `src/` change in Batch 1. Snapshot `parity.json` before Batch 2.
