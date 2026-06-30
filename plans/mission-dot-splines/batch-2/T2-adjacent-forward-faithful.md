# T2 — Adjacent-rank forward edges → faithful

## Context

Plain adjacent-rank forward edges currently route through the simplified fitter
(`routeForwardEdge` → `straightEdgeSplineWithRank`), which collapses steep
diagonals (wide fan-out/fan-in outer edges → ~0.4pt stubs). The faithful path
`routeRegularEdgeFaithful` (box-channel + pathplan `routeSplines`) is the C
algorithm. Make it the path for ALL adjacent-rank forward edges.

## Task

1. In `edge-route.ts:routeForwardEdge`, route plain adjacent-rank forward edges
   through the faithful path (drop the `hasSidePort` gate for the same-rank-
   adjacent... no: for ADJACENT-RANK forward edges generally), keeping the
   flat-label dispatch (`makeFlatLabeledEdge`/`makeAdjFlatLabeledEdge`) ahead of
   it. The simplified-fitter branch becomes unreachable for this category.
2. Extend `routeRegularEdgeFaithful` (`edge-route-faithful.ts`) as needed so it
   is conformant to dot for plain adjacent-rank edges — including steep
   diagonals (fan-out/in) and straight verticals. Mirror the C box construction
   (`rank_box`/`maximal_bbox`/`beginpath`/`endpath`); do NOT invent geometry.
3. Run the 115 goldens. Per AD-1/AD-3 they must stay conformant; any shift is
   a faithful-path bug — fix it against the dot oracle. If a golden matches dot
   but differs from the stored golden, STOP (stale golden).
4. Pin new oracle tests in `edge-route-splines.test.ts`: wide fan-out
   (`a->{b..f}`), fan-in/merge (`{b..f}->z`), and a mid fan (fan3) regression,
   at tol 0.5 (control points + that no edge is a degenerate stub).

## Write-set

- `src/layout/dot/edge-route.ts` — dispatch: adjacent-rank forward → faithful
- `src/layout/dot/edge-route-faithful.ts` — extend `routeRegularEdgeFaithful` for plain adjacent edges
- `src/layout/dot/edge-route-splines.test.ts` — new oracle pins
- `src/common/poly-inside.ts` — faithful clip: node-penwidth outline + rankdir
  rotation/flip (EXPANDED, approved by Scott 2026-06-16; see decision journal)
- `src/common/nodeinit.ts`, `src/common/types.ts` — plumb resolved node penwidth
  into the polygon descriptor (needed by the poly-inside penwidth fix)
- `src/common/splines-clip.ts` — faithful arrow polygon uses the style-aware
  render penwidth (`style=bold`), matching the fitter (third bug found in T2)

## Read-set

- `decisions.md#ad-1`, `#ad-2`, `#ad-3`; T1 inventory in `decision-journal.md`
- `~/git/graphviz/lib/dotgen/dotsplines.c:make_regular_edge` (1700+), `rank_box`, `maximal_bbox`
- `~/git/graphviz/lib/common/routespl.c:routesplines`
- `src/layout/dot/edge-route.ts:333-360` (`routeForwardEdge`)
- `src/layout/dot/edge-route-faithful.ts:154-312`
- `.probes/dot-splines-corpus.ts` (fanout/merge cases)

## Interface contract

`routeRegularEdgeFaithful(g, e)` returns spline control points (graphviz y-up)
for any plain adjacent-rank forward edge, or null only when not adjacent-rank.
The caller (`routeFaithfulSidePort` / `routeForwardEdge`) clip+installs.

## Acceptance criteria

- **Given** `digraph{a->b;a->c;a->d;a->e;a->f}`, **when** rendered, **then** every
  edge routes from a to its head within 0.5pt of dot (no degenerate stub).
- **Given** `digraph{b->z;c->z;d->z;e->z;f->z}`, **then** the outermost edges
  match dot within 0.5pt.
- **Given** the 115 goldens, **then** all conformant.
- **Given** the full suite, **then** passed >= baseline, 0 failed.

## Quality bar

`tsc --noEmit` 0; lizard clean on changed files; vitest green per gates.
Commit: `feat(T2): route adjacent-rank forward edges through pathplan`.

## Observability / Rollback

N/A — pure layout. Reversible (revert; goldens unchanged). If a golden byte-diff
cannot be closed, STOP (per README constraints).
