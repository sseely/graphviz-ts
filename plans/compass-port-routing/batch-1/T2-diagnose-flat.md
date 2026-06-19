# T2 — Diagnose flat-edge compass-port divergence (#241_0)

## Context
Same mission/harness as T1. `tests/241_0.dot` is a `splines=true` graph with a
`{rank=same}` block whose edges use compass ports on both ends, e.g.
`2:e -> 3:w`, `2:ne -> 3:nw`, `3:sw -> 2:se`, `1:se -> 6:sw`. These are **flat
(same-rank)** edges. The case diverges (Δ≈17.5) on one flat compass-port edge
(`svg/g[1]/g[7]/path[1]/@d`). Flat edges take a different code path than
regular edges (`make_flat_edge` / FLATEDGE begin/endpath).

## Task
`Instrument` C dot + the port; `dump` the flat-edge begin/endpath ports, the
flat-edge routing box, and the routed spline for the divergent edge in
`241_0.dot`; `identify` the divergent port function + C reference. Do NOT edit
`src/`.

1. Reuse the instrumented oracle from T1's recipe (`/tmp/gvplugins`). Add
   temporary C dumps in the FLATEDGE path: `beginpath`/`endpath` with
   `FLATEDGE`, `ED_tail_port.p`/`ED_head_port.p`, the flat box, routed spline.
2. Identify WHICH same-rank edge maps to `g[7]/path[1]` (order matches emission
   order); dump the port's begin/endpath ports + box + `e.info.spl` for it.
3. Compare; pin the first divergence; name the divergent function `file:line`
   + one-line root cause.

## Write-set
- `plans/compass-port-routing/decision-journal.md` (T2 rows only).
- Never edit `src/` in T2. (Temporary C `fprintf` dumps reverted before end.)

## Read-set
- `tests/241_0.dot`; cached oracle `$TMPDIR/dot-corpus-oracle/241_0.svg`.
- C: `lib/dotgen/dotsplines.c` (make_flat_edge, FLATEDGE beginpath/endpath ~1288),
  `lib/common/shapes.c:compassPort`, `lib/common/splines.c`.
- Port: `src/layout/dot/splines-flat.ts`, `src/layout/dot/splines-flat-labeled.ts`,
  `src/common/compass-port.ts`, `src/common/splines-path-shared.ts`.
- `decisions.md#ad-2`, `#ad-4`.

## Interface contract (consumed by T4)
`{ case: "241_0", divergentFn (file:line), cRef (file:line), rootCause (1 line),
  exemplarEdge: "<tail>:<port> -> <head>:<port>" }`.

## Acceptance criteria (Given/When/Then)
- **Given** instrumented C, **when** `241_0.dot` renders, **then** the divergent
  flat edge's begin/endpath ports, box, and routed control points are dumped.
- **Given** the port probe, **then** the matching port values are dumped.
- **Given** both dumps, **then** the first divergence is located and the
  divergent flat-edge function is named with `file:line` + root cause.
- **Given** the findings, **then** T4 can scope its fix without further work.

## Observability
N/A — diagnostic only.

## Rollback notes
Reversible — plan-doc append; revert temporary C edits.

## Boundaries
- **Always:** map the SVG path index to the exact same-rank edge before dumping.
- **Never:** edit `src/`; conflate the flat path with the regular (T1) path.
- **STOP (AD-4):** deep multi-cause flat-routing divergence → report and end.

## Commit
`docs(T2): diagnose #241_0 flat compass-port routing divergence`.

## Quality bar
No `src/` change committed. Return only the structured findings.
