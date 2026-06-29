# T1 — Adjacent labeled-flat curve geometry (Issue 2)

## Context

`makeSimpleFlatLabels` (`src/layout/dot/splines-flat-labeled.ts:264`) routes the
no-port adjacent flat group whose representative carries a label. The port
installs a STRAIGHT 4-point bezier `[tp, {...tp}, hp, {...hp}]` for the
representative edge `e0` (line 273), so 376→76 / 196→376 / 256→436 draw flat
horizontal stubs. C's `makeSimpleFlatLabels` (`dotsplines.c:944`) routes the
representative as a shallow ARC (376→76 C path is a 7-pt curve dipping to y≈0).
Port that geometry faithfully. C is the spec.

## Task

Implement the representative-edge geometry C produces, as pinned by the T0 trace
(`test/diagnostic/flat-geom-trace.md`):
- Replace the straight `[tp,tp,hp,hp]` install for `e0` with C's curve
  construction (the box/arc channel `makeSimpleFlatLabels` routes the rep edge
  through — read the T0 trace for the exact C path).
- Preserve the existing stacked-edge handling (`routeStackedFlats`) and label
  placement (`setFlatLabel`) unless the trace shows they also diverge.
- Match C's `tp`/`hp` endpoints and control points within survey tolerance.

Do NOT change `makeSimpleFlat` (unlabeled) or `makeFlatLabeledEdge` (non-adjacent)
unless the trace proves a shared helper is the divergence.

## Write-set
- `src/layout/dot/splines-flat-labeled.ts` (+ extend the flat-edge unit tests in
  the same file's `.test.ts` if one exists, or `src/layout/dot/*flat*.test.ts`)

## Read-set
- `decisions.md#ground-truth-data` (the 376→76 C-vs-port paths)
- `test/diagnostic/flat-geom-trace.md` (T0 output — the pinned C construction)
- `src/layout/dot/splines-flat-labeled.ts:264-296` (makeSimpleFlatLabels +
  simpleFlatPoints)
- `~/git/graphviz/lib/dotgen/dotsplines.c:944-1010` (C makeSimpleFlatLabels)

## Interface contracts
None (internal geometry). Output is the installed `e.info.spl` for the rep edge;
verified by SVG path `@d` parity, not a typed contract.

## Acceptance criteria
- Given 2368, when rendered, then 376→76 / 196→376 / 256→436 path `@d`
  byte-match the C oracle (no straight stub; the arc geometry matches).
- Given the full survey, when run, then GATE PASS with 0 regressions
  (no byte-match→worse) — else STOP + revert (AD-4).
- Given 2368_1 and 1624, when rendered, then still byte-match.
- Given the flat-edge unit tests, when run, then green (extend them to pin the
  arc geometry, not the old straight line).

## Observability / Rollback
N/A. Reversible (revert the commit).

## Quality bar
`tsc --noEmit` clean; `vitest run` green; survey GATE PASS 0 regressions. Commit:
`fix(flat): route adjacent labeled flats as C arcs, not straight stubs`.
