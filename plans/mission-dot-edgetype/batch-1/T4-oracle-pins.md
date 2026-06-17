# T4 — Oracle pins + comparison pages

## Context

T2/T3 made regular edges honor `splines=line|polyline`. This task proves parity
against the installed `dot` 15.0.0 binary and documents any divergence.

## Task

Create `src/layout/dot/edge-type-oracle.test.ts`. For each corpus case, render
via `renderSvg` and assert the first regular edge's `<path d="...">` control
points against geometry captured from `dot -Tsvg` (capture with a gitignored
`.probes/edgetype-oracle.ts`, documented in the test header like
`edge-route-faithful-oracle.test.ts`).

Corpus (minimum):
1. `digraph{rankdir=TB; a->b->c; a->c}` with `splines=polyline` — multi-rank PLINE.
2. same with `splines=line` — multi-rank LINE (makeLineEdge 4-pt).
3. adjacent `digraph{a->b}` with `splines=line` — box-straighten 4-pt.
4. adjacent `digraph{a->b}` with `splines=polyline` — PLINE.
5. labeled multi-rank `digraph{a->b->c; a->c[label=x]}` with `splines=line`
   — makeLineEdge 7-pt (if reachable; else quarantine).

Tolerance (AD-3): PLINE points 0.5pt; LINE straight endpoints 0.06pt.

Any case that cannot reach parity → write
`comparisons/<case>.md` (TS vs dot SVG, the divergence, the root cause) and
reference it in `decision-journal.md`. Do NOT alter oracle values to pass.

## Write-set

- CREATE `src/layout/dot/edge-type-oracle.test.ts`
- CREATE `plans/mission-dot-edgetype/comparisons/*.md` (only for quarantines)

## Read-set

- `src/layout/dot/edge-route-faithful-oracle.test.ts` (pin pattern, regexes,
  SVG-frame y-negation, tolerance precedent)
- `src/index.ts` (`renderSvg`)

## Architecture decisions

- AD-3 (tolerances), AD-4 (quarantine → comparison page).

## Acceptance criteria

- Given each corpus case, when rendered, then the regular edge control points
  match `dot -Tsvg` within the AD-3 tolerance.
- Given a quarantined case, when the mission closes, then a comparison page
  exists and is referenced in the decision journal (mission incomplete
  otherwise — CLAUDE.md).
- Given the full suite, when run, then 0 failed and 115 goldens byte-identical.

## Observability

N/A.

## Rollback

Reversible — test-only + docs.

## Quality bar

tsc 0; vitest 0 failed + 115 goldens byte-identical; lizard clean.
Commit: `test(T4): oracle-pin splines=line/polyline regular edges`.
