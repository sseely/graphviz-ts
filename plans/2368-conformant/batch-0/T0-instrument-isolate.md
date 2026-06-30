# T0 — Instrument + isolate both 2368 residuals

## Context

graphviz-ts is a faithful TS port of Graphviz C. After the prior mission,
`2368.dot` conforms to C on edge count/labels but diverges geometrically by two
root causes (see `decisions.md#ground-truth-data`). Pin each to its exact C-vs-
port first-divergence before any fix. C is the spec.

## Task

Produce a side-by-side C-vs-port trace for `2368.dot` at the two sites:

1. **Issue 2 — `makeSimpleFlatLabels` geometry.** Dump, for each adjacent
   labeled flat (376→76, 196→376, 256→436):
   - C (`lib/dotgen/dotsplines.c:makeSimpleFlatLabels`, gate by `getenv("FGEOM")`):
     the representative edge's installed control points (pn + each point), the
     `tp`/`hp` endpoints, and the arc/box construction it routes through.
   - Port (`src/layout/dot/splines-flat-labeled.ts:makeSimpleFlatLabels`, gate by
     `process.env.FGEOM`): the same — the `[tp,tp,hp,hp]` it currently installs.
   - The divergence is already known (C arc vs port straight); pin WHY: which C
     code path builds the arc (does C route the rep edge through a box channel or
     a curved spline?) so the fix is a faithful port, not a guess.

2. **Issue 1 — flat-label-rank vspace.** Dump:
   - C `flat.c:flat_node` label-vnode height (`ND_ht`) + the flat-label rank's
     `ht1`/`ht2`, and `position.c` `set_ycoords` rank-Y for the rank ABOVE the
     main flat band (where `{line7;136}` sits).
   - Port `src/layout/dot/flat.ts:flatNode`/`flatNodeDims` + `position-ycoords.ts`
     rank `ht1`/`ht2` for the same ranks.
   - Pin the first rank whose Y (or ht) differs by ~5pt between C and port.

Build: `make -C ~/git/graphviz/build gvplugin_dot_layout`; regen
`sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl`; capture with
`FGEOM=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/2368.dot -o /dev/null 2>/tmp/fgeom-c.txt`
and the port via `render-one.ts`. Then **revert C + rebuild clean**.

Write `test/diagnostic/flat-geom-diff.mjs` (align + print first divergence per
issue) and `test/diagnostic/flat-geom-trace.md` (recipe + the captured pinned
divergences).

## Write-set
- `test/diagnostic/flat-geom-trace.md` (create)
- `test/diagnostic/flat-geom-diff.mjs` (create)
- temporary, reverted: `~/git/graphviz/lib/dotgen/{dotsplines.c,flat.c,position.c}`,
  port files under `src/layout/dot/` (instrumentation removed before close)

## Read-set
- `src/layout/dot/splines-flat-labeled.ts:264-330` (makeSimpleFlatLabels + dispatch)
- `src/layout/dot/flat.ts:97-160` (flatNode/flatNodeDims)
- `src/layout/dot/position-ycoords.ts` (rank ht1/ht2)
- `~/git/graphviz/lib/dotgen/dotsplines.c:944-1010` (makeSimpleFlatLabels)
- `~/git/graphviz/lib/dotgen/flat.c` (flat_node)
- `decisions.md#ground-truth-data`

## Acceptance criteria
- Given the harness on 2368, when run, then `/tmp/fgeom-c.txt` + the port dump
  both contain the makeSimpleFlatLabels rep-edge control points AND the
  flat-label-rank ht/Y values.
- Given `flat-geom-diff.mjs`, when run, then it prints the first diverging value
  for Issue 2 (C arc shape vs port straight, with the C construction identified)
  and Issue 1 (the rank whose Y/ht differs by ~5pt, C vs port).
- Given the batch is closing, when `git status` is checked, then the C files are
  reverted + rebuilt clean and the port has no committed FGEOM code.

## Observability / Rollback
N/A — diagnostic only. Reversible (delete the two files).

## Quality bar
`npx tsc --noEmit` clean; `npx vitest run` green (diagnostic files must not break
collection). Commit: `test(diagnostic): flat-geometry trace for 2368 conformant`.
