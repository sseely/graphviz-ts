<!-- SPDX-License-Identifier: EPL-2.0 -->
# T5 — Types reference (`docs-site/guide/types.md`)

## Context

Consumers (e.g. plantuml-ts) work directly with the returned data structures —
`LayoutSnapshot` and its members — but there is no page explaining their
**shapes and relationships**. TypeDoc (T3) gives per-symbol reference; this
hand-written page gives the *conceptual* map with a diagram, and links into the
generated reference for exhaustive field lists.

## Task

Write `docs-site/guide/types.md`. Cover the public types grouped by entry point:

- **`graphviz-ts/api` (build + inspect):** `Graph` (opaque handle),
  `GvGraphBuilder`, `GvNode`, `GvEdge`, `CreateGraphOptions`.
- **`graphviz-ts/api` (geometry snapshot):** `LayoutSnapshot`, `NodeGeometry`,
  `EdgeGeometry`, `ClusterGeometry`, `BoundsGeometry`, `YAxis`,
  `GeometryOptions`.
- **`graphviz-ts/render`:** `OutputFormat`, `RenderOptions` (including the new
  `inlineImages` from T1), `Xdot`, `XdotOp`, `XdotColor`, `DrawOpsOptions`.
- **root:** `EngineName`, `ImageSizer`, `ImageResolver` (T1),
  `TextMeasurer`/`TextSize`, `RenderResult`, error types
  (`ParseError`, `RenderError`).

For each type: a one-line purpose, the field shape (small fenced `ts` block
copied faithfully from source), field meanings for the non-obvious ones, and
the y-axis/coordinate-frame note where relevant (see `getLayout`'s `yAxis`).

Add a **mermaid relationship diagram** showing containment/derivation:
`Graph → getLayout() → LayoutSnapshot → { nodes: NodeGeometry[], edges:
EdgeGeometry[], clusters: ClusterGeometry[], bounds: BoundsGeometry }`, and the
builder side `createGraph() → GvGraphBuilder → { addNode, addEdge } → Graph`.

End with a **"which type comes from which call"** table and links to
`/reference` (TypeDoc) for full field lists and `/guide/geometry` for the
coordinate-frame deep-dive.

## Read-set

- `src/api/geometry.ts:40-160` (all geometry interfaces + `getLayout`)
- `src/api/builder.ts` (builder types — read the exported `type`/`interface`)
- `src/render/public.ts:25-50` (`OutputFormat`, `RenderOptions`)
- `src/render/xdot-public.ts` (`Xdot`, `XdotOp`, `XdotColor`, `DrawOpsOptions`)
- `src/index.ts` (root re-exports: `EngineName`, `RenderResult`, errors)
- `docs-site/guide/geometry.md`, `docs-site/guide/api.md` (style + avoid dup)

## Acceptance criteria

- Given the page, then every type listed above appears with a faithful shape
  block and a one-line purpose.
- Given the mermaid diagram, then it renders (valid mermaid) and shows the
  snapshot containment + builder derivation.
- Given a reader, then each shape block matches the current source (no invented
  fields); coordinate-frame note present on geometry types.
- Given `npm run docs:build`, then the page builds and internal links resolve.

## Observability / Rollback

N/A / Reversible.

## Quality bar

`npm run docs:build` green. No `src` changes. Shapes verified against source.

## Boundaries

- **Always:** copy shapes verbatim from source; link, don't duplicate, the
  full field lists (those live in TypeDoc reference).
- **Never:** document internal (non-exported) types.

## Commit

`docs(T5): add types reference with shapes and relationship diagram`
