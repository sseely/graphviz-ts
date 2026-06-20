# T1 — Diagnose the non-adjacent flat curl (#241_0 `5:ne->8:nw`)

## Context
Faithful TS port of C graphviz (`~/git/graphviz`, tag 15.1.0 = spec). #241_0's
residual is Y-only: the port's flat edges curl less far than C, shorting the
bbox ~7pt. The topmost edge `5:ne->8:nw` (non-adjacent same-rank, TOP routing
via `routeFlatEdgeFaithful`) diverges in spline SHAPE:
- oracle `M402.02,-41.9 C413.34,-53.22 416.67,-57.24 432,-61.88 495.11,-80.98 533.98,-90.24 579.67,-49.74`
- port   `M402.02,-34.02 C451.44,-83.44 491.11,-74.25 558,-54 569.02,-50.67 573.84,-47.65 579.88,-42.01`
Start X matches (402.02); the 7.88 start-Y delta is the bbox shift; the control
points differ wholesale.

## Task
`Instrument` native C `make_flat_edge` (non-adjacent TOP path) and `dump` the
curl boxes + routed spline for `5:ne->8:nw` (+`1:se->6:sw`); `dump` the port's;
`classify` the FIRST real divergence (box-Y geometry vs endpoint vs spline-fit)
per AD-5 (final coords, rule out frame artifacts). Do NOT edit `src/`.

1. Build/refresh the instrumented oracle: rebuild `gvplugin_dot_layout`, copy to
   `/tmp/gvplugins`. Dump in C `make_flat_edge`: tend/hend boxes, the 3 mid
   boxes, P->start/end.p, and the routed `ps` for `5:ne->8:nw`.
2. Probe the port's `routeFlatEdgeFaithful` (temporary, reverted): the same
   boxes + `routeSplines` output for the same edge.
3. Compare. Since X compensates (AD-5), focus on Y: box LL.y/UR.y, the mid-box
   stepy stack, the endpoint Y, and the resulting control points. Name the
   divergent function `file:line` + a one-line root cause; state `isolable`.
4. Restore the clean C plugin to `/tmp/gvplugins`.

## Write-set
- `plans/flat-curl-y/decision-journal.md` (T1 rows).
- Never edit `src/` in T1. (Temporary C/port probes reverted before end.)

## Read-set
- `tests/241_0.dot`; cached oracle `$TMPDIR/dot-corpus-oracle/241_0.svg`.
- C: `lib/dotgen/dotsplines.c:make_flat_edge` (non-adjacent TOP), `maximal_bbox`,
  `makeFlatEnd`.
- Port: `src/layout/dot/splines-flat.ts` (`routeFlatEdgeFaithful`:462,
  `topBoxes`:359, `bottomBoxes`:379, `flatVspace`:401, `makeFlatEndBox`:339).
- `decisions.md#ad-2`, `#ad-4`, `#ad-5`; memory `flat-edge-241-is-y-only`.

## Interface contract (consumed by T3)
`{ path: "non-adjacent", divergentFn (file:line), cRef (file:line),
  cause (box-Y|endpoint|spline-fit), isolable: boolean, exemplar: "5:ne->8:nw" }`.

## Acceptance criteria (Given/When/Then)
- **Given** instrumented C, **when** `241_0.dot` renders, **then** the curl boxes
  + routed spline for `5:ne->8:nw` are dumped verbatim.
- **Given** the port probe, **then** the matching port values are dumped.
- **Given** both (Y-focused per AD-5), **then** the first real divergence is
  located, the divergent fn named `file:line`, and `cause`/`isolable` stated.
- **Given** the findings, **then** T3 can scope its fix; the clean C plugin is
  restored.

## Observability
N/A — diagnostic only.

## Rollback notes
Reversible — plan-doc append; revert temporary C/port probes + restore plugin.

## Boundaries
- **Always:** dump real C values; compare FINAL coords (AD-5); restore the plugin.
- **Never:** edit `src/`; touch the flat-edge X (it matches); conflate with the
  adjacent path (T2).
- **STOP:** non-isolable / deep multi-cause (AD-4); frame artifact (AD-5).

## Commit
`docs(T1): diagnose #241_0 non-adjacent flat curl-Y`.

## Quality bar
No `src/` change committed; clean plugin restored. Return only the structured
findings.
