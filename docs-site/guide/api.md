# API reference

The public surface is intentionally small. Most callers only need `renderSvg`.

> Type declarations (`.d.ts`) are not yet emitted by the build — the signatures
> below are the source of truth until they are. See
> [Known divergences](/divergences).

## `renderSvg`

```ts
function renderSvg(dotSource: string, engine: string): string;
```

Parses the DOT source, runs the named [layout engine](/guide/engines), renders
to SVG, and returns the SVG string.

- **`dotSource`** — DOT-language graph source.
- **`engine`** — one of `dot`, `neato`, `fdp`, `sfdp`, `circo`, `twopi`,
  `osage`, `patchwork`.
- **Throws** `ParseError` if `dotSource` is invalid, or an error if `engine` is
  not registered.

## `parse`

```ts
function parse(dotSource: string): Graph;
```

Parses DOT into the in-memory graph model **without** laying it out. Useful for
inspecting or transforming the graph before rendering.

## `setImageSizer`

```ts
type ImageSizer = (src: string) => { w: number; h: number } | null;

function setImageSizer(sizer: ImageSizer | null): void;
```

Registers a callback that returns the intrinsic dimensions of an external image
referenced by a node (e.g. `image="logo.png"`). Return `null` when the size is
unknown. Pass `null` to clear a previously-set sizer. See
[Browser usage](/guide/browser).

## Lower-level orchestration

For callers that need to drive layout and rendering as separate steps, the
GVC-style orchestration layer is exposed.

```ts
class GvcContext {
  constructor(measurer: TextMeasurer, options?: { debug?: DebugOptions });
  register(plugin: LayoutEngine | RendererPlugin): void;
  layout(g: Graph, engineName: string): void;
  freeLayout(g: Graph, engineName: string): void;
}

function render(ctx: GvcContext, g: Graph, format: string): string;
```

`renderSvg` is a convenience wrapper over this: it constructs a context,
registers the eight engines and the SVG renderer, lays out, renders, and frees.
Reach for `GvcContext` / `render` directly only when you need that control —
for example, to register a subset of engines or to render the same laid-out
graph to multiple formats.
