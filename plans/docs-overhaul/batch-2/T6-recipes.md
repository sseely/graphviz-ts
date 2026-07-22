<!-- SPDX-License-Identifier: EPL-2.0 -->
# T6 — Recipes cookbook (`docs-site/guide/recipes.md`)

## Context

`~/git/plantuml-ts` is a real production consumer of graphviz-ts. Its
`src/core/graph-layout.ts` exercises the full build→layout→read-geometry path
and solves the genuinely tricky bits: triggering layout, reconciling the
`render()` SVG coordinate frame with `getLayout()`'s frame, re-keying clusters
from graphviz-ts's `cluster<N>` names back to caller names, and recovering
edge-label positions. Harvest these into task-oriented recipes — the "how do I
actually…" page React/Angular docs call a cookbook.

## Task

Write `docs-site/guide/recipes.md` as a sequence of focused recipes, each:
a one-line problem statement, a minimal runnable `ts` snippet, and a short
"why". Derive them from the real patterns in plantuml-ts (adapt/simplify — do
not copy proprietary specifics; distill to the graphviz-ts API). Recipes to
include (at least):

1. **Build a graph in code and render it** — `createGraph` → `addNode`/
   `addEdge` → `render(g,'svg')`. (Cross-link `/guide/build-a-graph`.)
2. **Lay out without rendering, read node/edge geometry** — `getLayout` →
   iterate `nodes`/`edges`. Note that `getLayout` alone returns zeroed coords
   until a layout runs; show the `render()`-then-`getLayout()` ordering that
   plantuml-ts relies on (graph-layout.ts ≈line 380).
3. **Choose the y-axis for your renderer** — `getLayout(g,{yAxis:'down'})` for
   screen coords vs `'up'` for Graphviz-native. Link `/guide/geometry`.
4. **Reconcile the render() SVG frame with the getLayout() frame** — the
   constant `(dx,dy)` translation pattern (graph-layout.ts `computeRenderOffset`
   ≈line 158-190): derive the offset from any one node and apply it. Explain
   *why* the two frames differ.
5. **Recover edge-label positions** — getLayout exposes the label position;
   show reading it and echoing back caller data (graph-layout.ts ≈line 87, 255).
6. **Map graphviz-ts cluster names back to yours** — the `cluster<N>` →
   caller-name re-key (graph-layout.ts ≈line 110-132). Show building an
   `idByName` map before layout and re-keying `snapshot.clusters` after.
7. **Add many edges safely** — `addEdge` helper usage and why the safe helper
   exists (link `/reference` for `addEdge`).

End with a "putting it together" recipe: a compact function that takes a small
domain graph, lays it out, and returns positioned nodes + edges — the shape
plantuml-ts's `layoutGraph` produces.

## Read-set

- `~/git/plantuml-ts/src/core/graph-layout.ts` (the harvest source — read
  fully; it is well-commented)
- `~/git/plantuml-ts/src/core/graph-layout.types.ts` (shapes, for context)
- `src/api/builder.ts`, `src/api/geometry.ts` (the actual API being shown)
- `docs-site/guide/build-a-graph.md`, `docs-site/guide/geometry.md` (avoid dup;
  link instead)

## Acceptance criteria

- Given the page, then it contains ≥7 recipes, each with a runnable `ts`
  snippet using only the **public** graphviz-ts API (imports from
  `graphviz-ts`, `graphviz-ts/api`, `graphviz-ts/render`).
- Given the frame-reconciliation recipe, then it explains the render-vs-getLayout
  frame difference and shows the constant-offset derivation.
- Given the cluster recipe, then it shows the `cluster<N>` re-key with an
  `idByName` map.
- Given `npm run docs:build`, then the page builds and cross-links resolve.

## Observability / Rollback

N/A / Reversible.

## Quality bar

`npm run docs:build` green. Snippets use only public API and are internally
consistent with the current type shapes.

## Boundaries

- **Always:** distill to the public graphviz-ts API; adapt plantuml-ts patterns
  generically.
- **Never:** copy plantuml-ts business logic verbatim or reference its private
  types in snippets; never show internal graphviz-ts imports.
- **Ask first:** if a harvested pattern depends on API not publicly exported —
  log it (candidate future export) rather than documenting a private path.

## Commit

`docs(T6): add recipes cookbook harvested from the plantuml-ts consumer`
