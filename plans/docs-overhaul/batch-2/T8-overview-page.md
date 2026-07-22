<!-- SPDX-License-Identifier: EPL-2.0 -->
# T8 — Conceptual overview / mental model (`docs-site/guide/overview.md`)

## Context

React/Angular docs open with a conceptual overview that gives readers a mental
model before the API. graphviz-ts has three entry points
(`graphviz-ts`, `graphviz-ts/api`, `graphviz-ts/render`, per ADR-2) and a
pipeline (parse/build → layout → render / read-geometry). New users need this
map to know *which door to use*.

## Task

Write `docs-site/guide/overview.md`:

1. **What graphviz-ts is** (2-3 sentences; DOT in → SVG/geometry out, pure TS,
   browser-safe, faithful to C). Link the landing/getting-started.
2. **The pipeline** — a mermaid flow: DOT source →`parse()`→ `Graph`; or
   `createGraph()`→ `Graph`; `Graph` →layout→ (`render()` → SVG/json/xdot/map)
   and (`getLayout()` → `LayoutSnapshot`). Show that layout is triggered by
   rendering (or the geometry path) and that both consume the same `Graph`.
3. **The three entry points — which door?**
   - `graphviz-ts` (root): quick path — `renderSvg(dot, engine)`, `parse`,
     global config (`setTextMeasurer`, `setImageSizer`, `setImageResolver`).
   - `graphviz-ts/api`: build a graph in code + read computed geometry
     (`createGraph`, `addEdge`, `getLayout`).
   - `graphviz-ts/render`: multi-format output + structured draw-ops
     (`render`, `getDrawOps`).
   A small table: "I want to… → use…".
4. **Coordinate frames in one paragraph** — y-up (native) vs y-down (screen),
   pointer to `/guide/geometry` and the reconciliation recipe in `/guide/recipes`.
5. **Scope boundary** — SVG + json/xdot/dot/imagemap; no raster/PDF/GUI. Link
   `/divergences`.
6. **Where to go next** — a curated link list: getting-started, engines,
   build-a-graph, geometry, recipes, images, types, API reference, glossary.

Keep it a *map*, not a tutorial — link out for depth.

## Read-set

- `src/index.ts` (root surface), `src/api/index.ts`, `src/render/index.ts`
  (the three doors + their exports and the ADR-1/ADR-2 comments)
- `docs-site/guide/getting-started.md`, `docs-site/index.md` (tone; avoid dup)
- `docs-site/guide/engines.md`, `geometry.md`, `render-formats.md` (link targets)

## Acceptance criteria

- Given the page, then it has a valid mermaid pipeline diagram and a
  "which door?" table mapping intents to the three entry points.
- Given a new reader, then they can tell from this page alone whether to use
  `renderSvg`, `getLayout`, or `render`.
- Given `npm run docs:build`, then the page builds and links resolve.

## Observability / Rollback

N/A / Reversible.

## Quality bar

`npm run docs:build` green. Entry-point descriptions match the actual exports.

## Boundaries

- **Always:** stay a conceptual map; link out for tutorials/reference.
- **Never:** duplicate getting-started's step-by-step or restate full type
  shapes (that's T5).

## Commit

`docs(T8): add conceptual overview and entry-point mental model`
