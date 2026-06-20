# Batch 1 — diagnose both flat curl paths

Read-only to `src/`. T1 (non-adjacent) and T2 (adjacent) are **parallel** (both
append clearly-labeled journal rows; no `src/` writes). Each instruments native
C and classifies the Y/curl divergence.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Non-adjacent: instrument C `make_flat_edge` for `5:ne->8:nw` (+`1:se->6:sw`); dump curl boxes + routed spline, port vs C; classify (box-Y / endpoint / spline-fit); state isolable | opus | `decision-journal.md` (T1 rows) | — | [ ] |
| T2 | Adjacent: instrument C `make_flat_adj_edges` for `3:sw->2:se`, `2:ne->3:nw`; dump aux-graph boxes + routed spline, port vs C; classify; state isolable | opus | `decision-journal.md` (T2 rows) | — | [ ] |

## Interface (Batch 1 -> Batch 2)
Each task appends a journal row:
`{ path, divergentFn (file:line), cRef (C file:line), cause (box-Y|endpoint|
  spline-fit), isolable: bool, exemplar }`.
State whether T1 and T2 SHARE a cause (-> collapse T3).

## Diverging edges (final SVG, Y-only; X already matches C)
- `5:ne->8:nw` (non-adjacent, TOP): oracle peaks -90.24, port -83.44; whole
  spline shape differs (oracle M402,-41.9 ...-90.24...; port M402,-34 ...-83.44).
- `1:se->6:sw` (non-adjacent): flat, Y-shifted by the bbox (matches X).
- `3:sw->2:se` (adjacent): oracle curls below to +1.79; port routes straight.
- `2:ne->3:nw` (adjacent): top curl, shape differs.
- bbox height: oracle 86 vs port 79 (~7pt short).

## Candidate functions (confirm by instrumentation; AD-5: final coords only)
- Non-adjacent: `src/layout/dot/splines-flat.ts` (`routeFlatEdgeFaithful`,
  `topBoxes`/`bottomBoxes`, `flatVspace`, `makeFlatEndBox`).
- Adjacent: `src/layout/dot/splines-flat.ts` (`makeFlatAdjEdges`,
  `copyFlatSplines`, `repositionFlatAux`) + the aux pipeline.
- C: `lib/dotgen/dotsplines.c:make_flat_edge`, `make_flat_adj_edges`.

## Stop conditions
Per README. AD-4: if neither path is isolable -> STOP. AD-5: if a divergence is
a compensating internal-frame artifact (final coords match) -> not a bug, stop.

## Quality gates
No `src/` change in Batch 1. Snapshot `parity.json` before Batch 2. Restore the
clean C plugin to `/tmp/gvplugins` after instrumenting.
