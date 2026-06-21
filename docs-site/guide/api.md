# API reference

The public surface is intentionally small. Most callers only need `renderSvg`.

> Type declarations (`.d.ts`) are emitted by `npm run build` (the `build:types`
> step runs `tsc -p tsconfig.build.json`). The `package.json` `exports` map
> wires `types` conditions for each entry, so `graphviz-ts`, `graphviz-ts/api`,
> and `graphviz-ts/render` all resolve types in editors and downstream builds.
>
> The build also emits declaration maps (`.d.ts.map`) and JS source maps, and
> the package ships its `src/` sources — so "go to definition" jumps straight
> to the real TypeScript, making it easy to read the code and open a PR.

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

## Library API — new in Batch 3

Four functions cover programmatic construction, geometry readout, multi-format
rendering, and custom draw-op access. Each has a dedicated guide page.

### `createGraph`

```ts
function createGraph(opts?: {
  directed?: boolean;
  strict?:   boolean;
  name?:     string;
}): GvGraphBuilder;
```

Build a graph in code without writing DOT. Returns a `GvGraphBuilder` with
`addNode`, `addEdge`, `addSubgraph`, `setAttr`, `getAttr`, and a `.graph`
property for handoff to `render` / `getLayout` / `getDrawOps`. See
[Build a graph in code](/guide/build-a-graph).

### `render`

```ts
function render(
  g:      Graph,
  format: OutputFormat,
  opts?:  { engine?: string },
): string;
```

Lay out and render a graph to the requested format. `OutputFormat` is
`'svg' | 'dot' | 'xdot' | 'json' | 'plain' | 'plain-ext' | 'imap' | 'cmapx'`.
Engine defaults to `'dot'`. See [Render to other formats](/guide/render-formats).

### `getLayout`

```ts
function getLayout(g: Graph, opts?: { yAxis?: 'up' | 'down' }): LayoutSnapshot;
```

Return a plain, JSON-serializable snapshot of the graph's computed geometry
(node positions, edge spline points, bounding box). Call after `render` has run.
Default `yAxis: 'down'` gives screen coordinates (origin top-left). See
[Read computed geometry](/guide/geometry).

### `getDrawOps`

```ts
function getDrawOps(g: Graph, opts?: { engine?: string }): XdotOp[];
```

Lay out a graph, render to xdot, and return a flat typed draw-op array for
feeding a custom renderer. Switch on `op.kind` to dispatch each operation. See
[Custom rendering with xdot draw-ops](/guide/xdot-drawops).

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

function renderWithContext(ctx: GvcContext, g: Graph, format: string): string;
```

`renderSvg` is a convenience wrapper over this: it constructs a context,
registers the eight engines and the SVG renderer, lays out, renders, and frees.
The root `render(g, format, opts?)` does the same but accepts any registered
output format. Reach for `GvcContext` / `renderWithContext` directly only when
you need that control — for example, to register a subset of engines or to
render the same laid-out graph to multiple formats without re-running layout.
