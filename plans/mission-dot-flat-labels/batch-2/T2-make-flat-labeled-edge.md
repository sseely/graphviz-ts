# T2 — Port make_flat_labeled_edge + dispatch (non-adjacent)

## Context

After T1, a non-adjacent `rank=same` labeled edge has a label virtual node `ln`
(`ND_alg`=edge) on the rank above it. This task ports `make_flat_labeled_edge`
(dotsplines.c:1314-1416), dispatches to it, wires it into the live router, and
ensures the label `<text>` is emitted at dot's position. Non-adjacent case only;
the adjacent case (`make_flat_adj_edges`) is T3.

## Task

Port `make_flat_labeled_edge` (`lib/dotgen/dotsplines.c:1314-1416`) into
`splines-flat.ts`, faithfully:
- Walk `ED_to_virt(e)` to `ln`; set `ED_label(e).pos = ND_coord(ln)`, `.set=true`
  (C lines 1328-1333).
- `EDGETYPE_SPLINE` branch: build `lb` (label box), the `ydelta` clamp
  (`MAX(5, ydelta)`), `makeFlatEnd` (= existing `makeFlatEndBox`) for tail+head,
  the three connector boxes, `addBox` ordering (tail fwd, mid, head reversed),
  `routeSplines`, `clipAndInstall` (lines 1349-1413).
- `EDGETYPE_LINE` 7-point branch (lines 1338-1347).

Dispatch from `makeFlatEdge` when `ED_label(e)` is set — C order: AFTER the
`isAdjacent` branch, BEFORE bottom/top (`dotsplines.c:1530-1533`). Wire
`makeFlatEdge` (or the labeled path) into the live router so a non-side-port
labeled flat edge reaches it instead of the simplified fitter (determine: the
`dotSplines_` flat-group dispatch vs `routeOneEdge`; mirror how flat side-port
edges reach `routeFlatEdgeFaithful`). Ensure the post-routing label-placement
(`ND_alg` loop, dotsplines.c:283-291 / :422-428, or the existing
`placeRegularEdgeLabels` analog) leaves `ED_label.set=true` so emission fires.

Use existing TS helpers: `makeFlatEndBox`, `routeSplines`, `clipAndInstall`,
`addBox`, `transformf`. Do NOT invent geometry — mirror the C box construction.

## Write-set

- `src/layout/dot/splines-flat.ts` — add `makeFlatLabeledEdge`, dispatch in `makeFlatEdge`, live wiring
- `src/layout/dot/splines-flat-labeled.test.ts` — new oracle test

## Read-set

- `~/git/graphviz/lib/dotgen/dotsplines.c:1314-1416` (make_flat_labeled_edge), `:1502-1545` (dispatch), `:283-291`/`:422-428` (label placement)
- `src/layout/dot/splines-flat.ts` (`makeFlatEndBox`, `makeFlatEdge`, `routeFlatEdgeFaithful`)
- `decisions.md#ad-3`, `#ad-5`; T1 interface contract

## Acceptance criteria

- **Given** `{rank=same a->c->b[style=invis]} a->b[label="x"]`, **when** rendered,
  **then** the SVG contains the label `<text>x</text>` within 0.5pt of dot's `lp`,
  and the edge path matches dot within 0.5pt (or quarantine per AD-5).
- **Given** the same at `EDGETYPE_LINE` (`splines=line`), **then** the 7-point
  polyline matches dot within 0.5pt.
- **Given** the full suite, **then** ≥1793 pass, 0 fail, 115 goldens byte-identical.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green. Oracle from the built dot.
Commit: `feat(T2): port make_flat_labeled_edge + dispatch`.

## Observability / Rollback

N/A — pure layout. Reversible (revert; no goldens change).
