# T3 — Adjacent flat labeled edge label + oracle pins

## Context

After T2 the non-adjacent flat labeled edge emits its label. The ADJACENT case
(`{rank=same a b} a->b[label="x"]`, a and b adjacent in order) routes via
`make_flat_adj_edges` (the rotated auxiliary graph, already ported as
`makeFlatAdjEdges`), which currently drops the label (corpus: TS 2 texts / dot 3).
`make_flat_edge` dispatches adjacent edges to `make_flat_adj_edges` BEFORE the
`ED_label` check, so the label must be carried through that path.

## Task

1. Make the adjacent path emit its label. Inspect how the label travels through
   the aux-graph clone/route/copy-back in `makeFlatAdjEdges`: the label vnode or
   `ED_label` must be set so the label `<text>` emits at dot's position. Mirror
   what C's `make_flat_adj_edges` / the `ED_dist`/`ED_adjacent` label handling
   does (`flat.c` adjacent branch sets `ED_dist`; the label rides the edge).
2. Pin both cases as dot-oracle tests (AD-5): adjacent + non-adjacent label
   `<text>` positions and edge paths at tol 0.5.
3. Any sub-case that can't reach tol 0.5 → quarantine: pin TS actual + write
   `comparisons/<case>.html` (dot vs ts SVG + measured delta + root cause) +
   reference it in the decision journal. The batch is not complete until any
   such page exists.

## Write-set

- `src/layout/dot/splines-flat.ts` — adjacent-path label emission
- `src/layout/dot/splines-flat-labeled.test.ts` — extend with adjacent pin (+ quarantine if needed)

## Read-set

- `~/git/graphviz/lib/dotgen/dotsplines.c:1502-1545` (make_flat_edge dispatch / isAdjacent), `make_flat_adj_edges`
- `~/git/graphviz/lib/dotgen/flat.c` (ED_adjacent / ED_dist label handling)
- `src/layout/dot/splines-flat.ts` (`makeFlatAdjEdges`, `copyFlatSplines`)
- `decisions.md#ad-4`, `#ad-5`

## Acceptance criteria

- **Given** `{rank=same a b} a->b[label="x"]`, **when** rendered, **then** the
  label `<text>x</text>` is present within 0.5pt of dot's position (or quarantine
  per AD-5 with a comparison page).
- **Given** both adjacent and non-adjacent cases, **then** both are pinned as
  dot-oracle tests.
- **Given** the full suite, **then** ≥1793 pass, 0 fail, 115 goldens byte-identical.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green. Oracle from the built dot.
Commit: `feat(T3): emit adjacent flat-edge label + multi-case oracle pins`.

## Observability / Rollback

N/A — pure layout. Reversible. A batch with any quarantined case is not complete
until its comparison page exists and is referenced in the journal.
