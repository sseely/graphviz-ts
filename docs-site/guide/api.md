# API reference

The public surface is intentionally small. Most callers only need `renderSvg`.
See the [Overview](/guide/overview) for which entry point to use, [Types](/guide/types)
for the shapes each function consumes and returns, and the generated
[Reference](/reference/) for exhaustive signatures, every field, and every
overload.

> Type declarations (`.d.ts`) are emitted by `npm run build` (the `build:types`
> step runs `tsc -p tsconfig.build.json`). The `package.json` `exports` map
> wires `types` conditions for each entry, so `graphviz-ts`, `graphviz-ts/api`,
> and `graphviz-ts/render` all resolve types in editors and downstream builds.
>
> The build also emits declaration maps (`.d.ts.map`) and JS source maps, and
> the package ships its `src/` sources — so "go to definition" jumps straight
> to the real TypeScript, making it easy to read the code and open a PR.

This page is organized by the three entry points ([Overview](/guide/overview)
covers when to reach for each): the root `graphviz-ts` package (parse + render
in one call, plus process-global configuration), `graphviz-ts/api` (build a
graph in code, read back computed geometry), and `graphviz-ts/render`
(multi-format output and raw draw-ops). Every function below re-exports from
the root package too (`export * from './api/index.js'` /
`export * from './render/index.js'` in `src/index.ts`) — importing everything
from `graphviz-ts` works, but the sub-path imports are more explicit about
which layer you're touching.

## `graphviz-ts` (root)

### `renderSvg`

```ts
function renderSvg(dotSource: string, engine: EngineName): string;
```

Parses the DOT source, runs the named [layout engine](/guide/engines), renders
to SVG, and returns the SVG string. This is the one-call convenience wrapper:
it constructs a `GvcContext`, registers the eight built-in engines and the SVG
renderer, lays out, renders, and frees the layout — see
[`GvcContext` / `renderWithContext`](#gvccontext-renderwithcontext) below if
you need those steps separated.

- **`dotSource`** — DOT-language graph source.
- **`engine`** — `EngineName`: one of the built-ins (`dot`, `neato`, `fdp`,
  `sfdp`, `circo`, `twopi`, `osage`, `patchwork`) or any custom-registered name.
- **Throws** `ParseError` if `dotSource` is invalid; `RenderError` if layout or
  rendering fails. Every throw implements the shared `GvError` shape.

Full signature, JSDoc, and the `GvError` field list: [Reference](/reference/).

### `tryRenderSvg` / `RenderResult`

```ts
function tryRenderSvg(dotSource: string, engine: EngineName): RenderResult;
```

Result-style sibling of `renderSvg` — never throws. Returns `{ svg }` on
success or `{ errors: [one] }` on the first failure; `svg` and `errors` are
mutually exclusive. Each entry in `errors` is a plain, JSON-serializable
`GvError` object (no stack trace), so it's safe to send across a
worker/postMessage boundary or serialize into a log. Prefer this over
`renderSvg` + `try`/`catch` when the caller wants to branch on `code` /
`type` rather than catch an exception. [Reference](/reference/).

### `parse` / `ParseError`

```ts
function parse(dotSource: string): Graph;
```

Parses DOT into the in-memory graph model **without** laying it out. Useful
for inspecting or transforming the graph — or handing it to `graphviz-ts/api`'s
`getLayout` / `graphviz-ts/render`'s `render` — before rendering.

- **Throws** `ParseError` for syntax errors or edge-direction violations (e.g.
  `->` in an undirected graph). `ParseError` implements `GvError` with
  `type: 'syntax'` and carries a `location: { line, column, offset? }` when the
  parser can pinpoint one. [Reference](/reference/).

### `RenderError`

```ts
class RenderError extends Error implements GvError {
  readonly type: 'render';
  readonly code: GvErrorCode;
  readonly friendlyMessage: string;
}
```

Thrown for known layout/render-stage failures (`code` is `'RENDER_ERROR'` or
`'GENERIC_ERROR'`). Every graphviz-ts throw — `ParseError`, `RenderError`, or
an `HtmlParseError` from an HTML-like label — implements the shared `GvError`
contract, so callers can branch on `err.type` / `err.code` without an
`instanceof` chain per error class. See [Types](/guide/types) for the full
`GvError` shape and [Reference](/reference/) for `GvErrorCode`'s member list.

### `setTextMeasurer` / `getTextMeasurer`

```ts
function setTextMeasurer(measurer: TextMeasurer | null): void;
function getTextMeasurer(): TextMeasurer;
```

Registers (or clears, with `null`) the process-global text measurer consulted
during layout to size labels. Clearing falls back to the library default
(browser: `CanvasTextMeasurer`; headless/Node: `EstimateTextMeasurer`, unless a
LUT measurer is wired — see [Text measurement](/guide/text-measurement) for the
full resolution order and the `CanvasTextMeasurer` / `EstimateTextMeasurer` /
`LutTextMeasurer` implementations exported alongside these functions).
[Reference](/reference/).

### `setImageSizer` / `setImageResolver`

Two related, but distinct, image-configuration seams — both process-global
registries mirroring the same pattern (register a callback, pass `null` to
clear), both no-ops until a caller registers one:

- **`setImageSizer`** — reports an external image's *intrinsic dimensions* so
  the layout engine can reserve space for an HTML `<IMG>` cell or a node
  `image=` attribute before rendering. Returning `null` (or leaving no sizer
  registered) reproduces native Graphviz's missing-image behavior: a warning
  and zero size.
- **`setImageResolver`** (new — see [`inlineImages`](#inlineimages) below) —
  supplies the actual image *bytes* so the SVG renderer can inline them as a
  `data:` URI instead of emitting `xlink:href="src"` as a raw passthrough.

```ts
type ImageSizer = (src: string) => { w: number; h: number } | null;
function setImageSizer(sizer: ImageSizer | null): void;

type ImageResolver = (
  src: string,
) => { bytes: Uint8Array; mime?: string } | Uint8Array | null;
function setImageResolver(fn: ImageResolver | null): void;
```

`ImageResolver` may return a bare `Uint8Array` (MIME inferred from `src`'s file
extension — `.png`, `.jpg`/`.jpeg`, `.gif`, `.svg`, `.webp`; anything else
falls back to `application/octet-stream`) or `{ bytes, mime }` to set the MIME
type explicitly. Return `null` when `src` can't be resolved — the renderer
falls back to the raw `src` passthrough, same as no resolver being registered.
Registering a resolver has no effect by itself; it's consulted only when
`render`'s `inlineImages` option is `true` (below). See
[Working with images](/guide/images) for a worked example and
[Reference](/reference/) for both callback types.

### `GvcContext` / `renderWithContext`

```ts
class GvcContext {
  constructor(measurer: TextMeasurer, options?: { debug?: DebugOptions });
  register(plugin: LayoutEngine | RendererPlugin): void;
  layout(g: Graph, engineName: EngineName): void;
  freeLayout(g: Graph, engineName: EngineName): void;
}

function renderWithContext(ctx: GvcContext, g: Graph, format: string): string;
```

Lower-level orchestration for callers that need to drive layout and rendering
as separate steps. `renderSvg` is a convenience wrapper over exactly this:
construct a context, register engines/renderers, `layout`, `renderWithContext`,
`freeLayout`. Reach for these directly only when you need that control — for
example, to register a subset of engines, add a custom `LayoutEngine` or
`RendererPlugin`, or render the same laid-out graph to multiple formats
without re-running layout (call `layout` once, then `renderWithContext` for
each format, then `freeLayout`). [Reference](/reference/).

## `graphviz-ts/api`

Programmatic construction, safe edge insertion, and computed-geometry readout
— the layer for building a graph without hand-writing DOT text and reading its
layout back as plain data. See [Types](/guide/types) for `LayoutSnapshot` and
its nested shapes.

### `createGraph`

```ts
function createGraph(opts?: {
  directed?: boolean;
  strict?:   boolean;
  name?:     string;
}): GvGraphBuilder;
```

Creates a fresh graph ready for handoff to `render` / `getLayout` /
`getDrawOps`. Defaults: `directed: true`, `strict: false`, `name: ''`. Returns
a `GvGraphBuilder` — `addNode`, `addEdge`, `addSubgraph`, `setAttr`/`getAttr`,
`setHtmlAttr` (for HTML-table labels), and a `.graph` property exposing the
opaque `Graph` handle. See [Build a graph in code](/guide/build-a-graph) and
[Reference](/reference/) for the full `GvGraphBuilder`/`GvNode`/`GvEdge`
interfaces.

### `addEdge`

```ts
function addEdge(g: Graph, tail: Node, head: Node, name?: string): Edge;
```

Lower-level edge-insertion helper underlying `GvGraphBuilder.addEdge` —
exported directly for callers working with the internal `Node`/`Edge`
references (e.g. edges added onto a graph returned by `parse()`) rather than
the builder's opaque `GvNode`/`GvEdge` handles. Most callers should use
`createGraph(...).addEdge(tail, head, attrs?)` instead.

- **`name`** — edge key; defaults to `''` (anonymous). Ignored for strict-graph
  dedup, which matches on `(tail, head)` alone (symmetric for undirected
  graphs).
- **Returns** the new edge, or the existing one if `g` is strict and a
  `(tail, head)` edge already exists (mirrors `agedge` with `cflag=1`).

See [Build a graph in code](/guide/build-a-graph) and
[Reference](/reference/).

### `getLayout`

```ts
function getLayout(g: Graph, opts?: { yAxis?: 'up' | 'down' }): LayoutSnapshot;
```

Returns a plain, JSON-serializable snapshot of the graph's computed geometry —
node positions, edge spline control points, edge labels, cluster bounding
boxes, and the overall graph bounds — all in points.

- **`g`** — must already be laid out (via `render(g, ...)`, `getDrawOps(g)`, or
  `ctx.layout(g, engine)`); calling `getLayout` on a not-yet-laid-out graph
  throws rather than silently returning all-zero geometry.
- **`opts.yAxis`** — default `'down'`: screen coordinates, origin top-left, y
  increases downward, and `bounds` is normalized to `(0, 0)`. `'up'` returns
  native Graphviz coordinates (origin bottom-left, y increases upward) with
  `bounds.x`/`bounds.y` at the raw lower-left corner.
- **Throws** `RenderError` if `g` has not been laid out.

Node `width`/`height` are converted to points (the internal model stores
inches); every other coordinate is already in points. See
[Read computed geometry](/guide/geometry) for the coordinate-system writeup
and [Types](/guide/types) / [Reference](/reference/) for the full
`LayoutSnapshot`, `NodeGeometry`, `EdgeGeometry`, `ClusterGeometry`, and
`BoundsGeometry` field lists.

### `Graph`

Opaque handle type re-exported from the internal model. Only the *type* is
exposed (not the mutable class) — annotate a variable holding a builder's
`.graph` or a `parse()` result with it, but don't construct or inspect its
fields directly; use the builder, `getLayout`, or `getDrawOps` to read state
back out. [Reference](/reference/).

## `graphviz-ts/render`

Multi-format output and raw draw-op access — the layer for rendering an
already-`parse`d or builder-constructed graph.

### `render`

```ts
function render(
  g:      Graph,
  format: OutputFormat,
  opts?:  RenderOptions,
): string;
```

Lays out and renders a graph to the requested format string.

- **`format`** — `OutputFormat`: `'svg' | 'dot' | 'xdot' | 'json' | 'plain' |
  'plain-ext' | 'imap' | 'cmapx'`.
- **`opts.engine`** — layout engine (default `'dot'`).
- **`opts.inlineImages`** — see [below](#inlineimages).
- **Throws** `RenderError` on layout or render failure.

`opts.engine` mirrors `renderSvg`'s `engine` parameter; `format` is the axis
`renderSvg` doesn't expose (`renderSvg` is hardcoded to `'svg'`). See
[Render to other formats](/guide/render-formats) and [Reference](/reference/)
for the full `OutputFormat` union and `RenderOptions` shape.

#### `inlineImages`

`RenderOptions.inlineImages` (default `false`) inlines external images as
`data:` URIs instead of the raw `xlink:href="src"` passthrough. It has no
effect unless a resolver is registered via `setImageResolver` (above) — and no
effect on non-SVG formats. Unset, output is byte-identical to before this
option existed.

```ts
import { setImageResolver } from 'graphviz-ts';
import { render } from 'graphviz-ts/render';
import { parse } from 'graphviz-ts';

setImageResolver((src) => {
  // Return the bytes for any src your DOT source references via
  // `image="..."` or an HTML <IMG SRC="...">; null for anything else.
  if (src === 'logo.png') return fetchLogoBytesSync(); // Uint8Array
  return null;
});

const g = parse('digraph { a [image="logo.png" shape=none label=""]; }');
const svg = render(g, 'svg', { inlineImages: true });
// svg now embeds `xlink:href="data:image/png;base64,..."` for the `a` node
// instead of `xlink:href="logo.png"`.
```

See [Working with images](/guide/images) for the full guide, including
resolving from `fetch` in the browser and from the filesystem in Node.

### `getDrawOps` / `DEFAULT_DRAW_ENGINE`

```ts
const DEFAULT_DRAW_ENGINE: EngineName; // 'dot'

function getDrawOps(g: Graph, opts?: { engine?: EngineName }): XdotOp[];
```

Lays out `g`, renders to xdot, and returns a flat, typed draw-op array — node
shapes, text spans, colors, and fonts as discriminated-union values (narrow on
`op.kind` in a `switch`) — for feeding a custom canvas/WebGL/PDF renderer
without touching SVG or xdot's string encoding. `opts.engine` defaults to
`DEFAULT_DRAW_ENGINE` (`'dot'`).

- **Throws** `ParseError` if the intermediate xdot output can't be re-parsed
  (defensive; not expected in practice); `RenderError` on layout/render
  failure.

See [Custom rendering with xdot draw-ops](/guide/xdot-drawops) for the op-kind
list and a worked canvas example, and [Types](/guide/types) /
[Reference](/reference/) for the full `XdotOp` union and `Xdot`/`XdotColor`
shapes.
