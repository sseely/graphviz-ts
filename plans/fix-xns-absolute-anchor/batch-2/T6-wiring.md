# T6 — Degenerate labeled-flat wiring (map_edge / edge_in_box)

## Context
With Batch 1 done, spline-less edge labels land at C's internal positions. C draws
a degenerate labeled flat leg iff its (untranslated) label overlaps the final clip
(`edge_in_box`/`overlap_label`); `map_edge` already leaves no-spline labels
untranslated and the port's `mapEdge` already early-returns on `spl===undefined`
(verify). Three coupled changes make the port match for 2368 (draw label-only),
2368_1 (suppress — label off-canvas), and keep 1624.

This reverses the band-aid skip added earlier (see
`.agent-notes/2368_1-flat-opposing-merge-abomination.md` and
`.agent-notes/1624-flat-cross-cluster-corridor.md`) in favor of the faithful path.

## Task
1. `splines-flat-labeled.ts:makeFlatLabeledEdge` — on degenerate route
   (`ps===null||length===0`), `return true` (handled: label already `set`, no
   spline installed) instead of `false`. Mirrors C `make_flat_labeled_edge`
   returning after `routesplines` pn=0 with the label set.
2. `edge-route.ts` — remove the `routeLoneEdge` skip
   (`sameRank && label!==undefined && getMainEdge(e)!==e`); add `label===undefined`
   guard to the non-adjacent flat corridor branch (labeled flats must go to
   make_flat_labeled, not the corridor).
3. `svg.ts:edgeHasDrawableContent` — replace the `label.set` test with a faithful
   `edge_in_box`: draw the group iff `spl` overlaps the clip OR a *positioned*
   label overlaps the graph clip box (`overlap_label`: label box = pos ± dimen/2;
   clip = graph bb). Port `overlap_label` from `lib/common/utils.c`; get the clip
   from `g.info.bb` (final frame). Keep head/tail/xlabel handling.

## Write-set
- `src/layout/dot/splines-flat-labeled.ts`
- `src/layout/dot/edge-route.ts`
- `src/render/svg.ts`

## Read-set
- `~/git/graphviz/lib/common/emit.c:edge_in_box`, `lib/common/utils.c:overlap_label`,
  `lib/common/postproc.c:map_edge`
- `src/common/postproc.ts:mapEdge` (confirm the no-spline early return)
- the two `.agent-notes` files above (what the skip/gate currently do)

## Acceptance criteria
- Given Batch 1 done, when 2368 renders, then `256->376`/`376->256` emit the
  label `<text>` (no path) and `376->76`/`196->376`/`256->436` emit path+label —
  byte-match C (11 edges, 9 paths).
- Given 2368_1 renders, then `256->376` emits NOTHING (label off-canvas) —
  byte-match preserved.
- Given 1624 renders, then it stays byte-match.
- Given the full survey, then 0 regressions.

## Observability / Rollback
N/A. Reversible.

## Quality bar
tsc + vitest green (update/extend any flat-edge unit tests); survey gate 0
regressions. Commit: `fix(flat): draw degenerate labeled flats via faithful edge_in_box`.
