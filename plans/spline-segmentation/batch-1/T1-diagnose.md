# T1 — Instrument C + locate the segmentation divergence

## Context
graphviz-ts is a faithful TS port of C graphviz (`~/git/graphviz` = spec). The
dot parity survey flags `graphs/jcctree.gv`, `graphs/p2.gv`, `graphs/pm2way.gv`
as `diverged` with first-diff on an edge `@d` path: same command letters
(`M`+`C` cubic beziers), but a DIFFERENT NUMBER of bezier control points than the
oracle, overlapping coords matching (Δ≈0). The bezier COUNT is set during dot
spline-fitting (`routesplines`/`Proutespline`), not emission — `svgEdgePath`/
`emitBezierPath` (`src/render/svg-helpers.ts`) just output the stored points.

## Task
`Instrument` the native oracle and `identify` exactly where the port's edge
spline-fit produces a different control-point count than C, for ONE input first
(`jcctree`, or `p2` if simpler). Do NOT fix yet; do NOT edit `src/`.

1. Dump the oracle's spline control points for the divergent edge: rebuild
   `gvplugin_dot_layout` with a probe (or use an object-linking probe into
   `lib/dotgen`) and copy to `/tmp/gvplugins`; render the input and capture the
   `ED_spl(e)` bezier list (count + coords) for the failing edge. See memory
   `recover-slack-and-c-harness` for the rebuild recipe.
2. Dump the port's control points for the same edge (`render-one.ts` + parse the
   `<path d>`, or add a temporary throw-instrument in the spline-fit path).
3. Compare counts/coords; walk the port's dot edge-route subsystem
   (`src/layout/dot/edge-route-*.ts`, `splines-route.ts`, `edge-route-routing.ts`,
   the `Proutespline`/`routesplines` port) to find the function whose output
   count diverges. Confirm it is a SEGMENTATION difference (counts differ, shared
   coords match), not a routing-POSITION difference (coords differ).

## Write-set
- `plans/spline-segmentation/decision-journal.md` (append the findings row).
- **Never** edit `src/` in T1.

## Read-set
- C: `~/git/graphviz/lib/dotgen/dotsplines.c` (routesplines, make_regular_edge,
  the bezier list build), `~/git/graphviz/lib/pathplan/` (Proutespline).
- Port: `src/layout/dot/edge-route-chain.ts`, `splines-route.ts`,
  `edge-route-routing.ts`, `edge-route-faithful.ts`; `src/render/svg-helpers.ts`
  (`svgEdgePath`, `emitBezierPath`) for the emission contract.
- `decisions.md#ad-2-diagnosis-before-fix`.

## Interface contract (consumed by T2)
Append to `decision-journal.md`:
`{ divergentFn, cRef, cControlPoints:[count,…], portControlPoints:[count,…],
   rootCause }` (see batch overview).

## Acceptance criteria (Given/When/Then)
- **Given** the oracle, **when** instrumented, **then** the failing edge's C
  control-point count + coords are dumped for ≥1 input.
- **Given** the port, **when** its spline-fit is traced, **then** the function
  whose output count diverges is named with `file:line`.
- **Given** both dumps, **when** compared, **then** it is CONFIRMED to be a
  segmentation (count) difference, not a routing-position one — else STOP and
  report (out of scope).
- **Given** the findings, **when** T1 ends, **then** the decision-journal row is
  complete enough that T2 needs no further C instrumentation to scope its fix.

## Observability
N/A — diagnostic task, no new observable operations.

## Rollback notes
Reversible — appends to a plan doc only.

## Boundaries
- **Always:** dump real C values before concluding; confirm segmentation-not-position.
- **Never:** edit `src/`; modify C source committed state (probe in /tmp); touch
  `test/golden/`.

## Commit
`docs(T1): diagnose dot spline bezier-segmentation divergence`.

## Quality bar
No `src/` change (`git diff --name-only -- src/` empty). Return only the
structured findings — no preamble.
