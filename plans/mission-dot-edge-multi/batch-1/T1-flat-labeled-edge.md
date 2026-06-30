# T1 — Port make_flat_labeled_edge (G4)

## Context

graphviz-ts is a faithful TS port of graphviz C (tag 15.0.0, `~/git/graphviz`,
the spec). A `rank=same` edge that carries a label (e.g.
`digraph{{rank=same a b} a->b[label="lbl"]}`) currently renders with **no label
`<text>`**: the corpus diff (`route-reverification.md`, case "flat labeled")
shows C emits 3 texts, graphviz-ts 2. `make_flat_labeled_edge` is unported;
`makeFlatEdge` never dispatches to it.

## Task

Port `make_flat_labeled_edge` from `lib/dotgen/dotsplines.c:1314-1412` and
dispatch to it from `makeFlatEdge` when `ED_label(e)` is set (the C check at
`dotsplines.c:1532`: `if (ED_label(e)) { make_flat_labeled_edge(...); return 0; }`,
placed AFTER the `isAdjacent` branch and BEFORE the bottom/top branches).

Port faithfully, including:
- Walk the `ED_to_virt(e)` chain to the label virtual node `ln`; set
  `ED_label(e).pos = ND_coord(ln)` and `.set = true` (lines 1328-1333).
- The `EDGETYPE_SPLINE` branch: build `lb` (label box), the `ydelta` clamp
  (`MAX(5, ydelta)`), `makeFlatEnd` for tail and head, the three connector
  boxes, `add_box` ordering (tail boxes, mid boxes, head boxes reversed),
  `routesplines`, `clip_and_install` (lines 1349-1410).
- The `EDGETYPE_LINE` 7-point branch (lines 1338-1348).

Use the existing TS helpers: `makeFlatEndBox` (= C `makeFlatEnd`), `routeSplines`,
`clipAndInstall`, `addBox`, `transformf`. Do NOT invent new geometry — mirror the
C box construction exactly.

The label virtual node: verify rank/mincross already creates a label vnode for
flat labeled edges (the `EDGE_LABEL` / `GD_has_labels` path). If the
`ED_to_virt` chain to `ln` is absent, port that creation too (cite the C site in
the journal) — this is the load-bearing nuance, do not stub around it.

## Write-set

- `src/layout/dot/splines-flat.ts` — add `makeFlatLabeledEdge`, dispatch in `makeFlatEdge`
- `src/layout/dot/splines-flat-labeled.test.ts` — new oracle test

## Read-set

- `~/git/graphviz/lib/dotgen/dotsplines.c:1314-1412` (make_flat_labeled_edge), `:1502-1543` (dispatch)
- `src/layout/dot/splines-flat.ts` — existing `makeFlatEndBox`, `makeFlatEdge`, `copyOneFlatSpline`
- `decisions.md#ad-2` (faithful pipeline), `#ad-3` (oracle bar)

## Acceptance criteria

- **Given** `digraph{{rank=same a b} a->b[label="x"]}`, **when** rendered,
  **then** the SVG contains the label `<text>x</text>` at dot's position
  (within 0.5pt of the built dot), and the edge path matches dot within 0.5pt.
- **Given** the same graph at `EDGETYPE_LINE` (e.g. `splines=line`), **when**
  rendered, **then** the 7-point polyline matches dot within 0.5pt.
- **Given** the full suite, **when** run, **then** ≥1789 pass, 0 fail, 115
  goldens conformant.

## Quality bar

`tsc --noEmit` 0; lizard clean on the changed file; vitest green per gates.
Oracle values captured from `~/git/graphviz/build/cmd/dot/dot` with
`GVBINDIR=/tmp/gvplugins`. Commit: `feat(T1): port make_flat_labeled_edge`.

## Observability / Rollback

N/A — pure layout function, no runtime services. Reversible (revert the commit;
no goldens change).
