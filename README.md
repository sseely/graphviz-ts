<!-- SPDX-License-Identifier: EPL-2.0 -->

# @knowvah/dot-engine

A faithful TypeScript port of [Graphviz](https://graphviz.org/) — the
graph-visualization toolkit that originated at AT&T Bell Labs (a foundational
technical report dates to 1991). It parses the
[DOT language](https://graphviz.org/doc/info/lang.html), runs Graphviz's layout
engines, and emits SVG. Ported line-by-line from the canonical
[C source](https://gitlab.com/graphviz/graphviz); see
[Graphviz on Wikipedia](https://en.wikipedia.org/wiki/Graphviz) for background.

The defining property: **pure TypeScript — no C.** No compiled Graphviz binary, no WASM build of it, no native dependencies.
It runs in a browser or in Node with zero external dependencies at runtime. The
goal is the closest achievable fidelity to the C implementation, which is treated
as the canonical specification (see [`CLAUDE.md`](./CLAUDE.md)). In practice the
`dot` engine is **conformant** with the C binary on the golden corpus: numeric
coordinates agree to a tight deterministic tolerance (±0.01) and non-numeric
content is exactly equal. This is the measured "match" bar, not a claim of
literal byte-for-byte SVG output — see [Conformance](./docs/conformance.md) for
the exact definition and the comparison code, and
[known divergences](./docs/known-divergences.md) for the documented exceptions.

> **Status: `0.1.x` — in active development, published to npm.** The port is
> mature enough to lay out and render real graphs across all engines; the C
> feature surface is not 100% covered. The `dot` engine is the primary
> fidelity target. See [Status & coverage](#status--coverage) below.

## Why this exists

Existing ways to render DOT in a JS environment shell out to a Graphviz
binary, a rendering server, or a WASM build — none of which run everywhere a
browser does, and all of which add deployment friction. @knowvah/dot-engine removes
that dependency entirely: the layout engine *is* TypeScript.

## Install

```bash
npm i @knowvah/dot-engine
```

Ships as ESM bundles with TypeScript declarations, zero runtime dependencies.
Entry points: `@knowvah/dot-engine` (core), `@knowvah/dot-engine/api` (graph-building API),
`@knowvah/dot-engine/render` (renderers).

To build from source instead: clone, `npm install`, `npm run build`
(esbuild bundles + `.d.ts` declarations into `dist/`).

## Quick start

```ts
import { renderSvg } from '@knowvah/dot-engine';

const dot = `
  digraph {
    a -> b;
    b -> c;
    a -> c;
  }
`;

const svg = renderSvg(dot, 'dot');
console.log(svg); // <svg ...>...</svg>
```

`renderSvg(dotSource, engine)` parses the DOT source, runs the named layout
engine, renders to SVG, and returns the SVG string. On failure it throws a
structured error — see [Error handling](#error-handling).

## Error handling

`renderSvg` throws on any failure; for a result-style alternative that never
throws, use `tryRenderSvg`:

```ts
import { tryRenderSvg } from '@knowvah/dot-engine';

const result = tryRenderSvg('digraph { a ->', 'dot');
if (result.svg) {
  // success
} else {
  const err = result.errors[0];
  console.error(err.code, err.friendlyMessage, err.location);
  // 'SYNTAX_UNEXPECTED_EOF' · 'The DOT source ended unexpectedly …' · { line, column, offset }
}
```

A `RenderResult` is `{ svg }` **or** `{ errors }` (never both); `errors` holds at
most the first failure. Each entry is a plain, JSON-serializable `GvError`:

| Field | Meaning |
|-------|---------|
| `type` | `'syntax'` · `'semantic'` · `'render'` |
| `code` | Stable machine key (an i18n key) — branch on this |
| `message` | Concise technical text |
| `friendlyMessage` | Approachable, non-localized English for end users |
| `location?` | `{ line, column, offset? }` — the real error position |
| `expected?` | Parser expectation list, for syntax errors only |

The `code` values are a closed union: `SYNTAX_ERROR`, `SYNTAX_UNEXPECTED_EOF`,
`EDGE_OP_DIRECTED_IN_UNDIRECTED`, `EDGE_OP_UNDIRECTED_IN_DIRECTED`,
`HTML_PARSE_ERROR`, `RENDER_ERROR`, `GENERIC_ERROR`.

The throwing `renderSvg` raises the same structured values as real `Error`
subclasses — `ParseError` (syntax) and `RenderError` (render) — each carrying
`code`, `type`, `friendlyMessage`, and (for `ParseError`) `location`/`expected`.
Branch on `.code`/`.type` rather than `instanceof` per subclass.

## Layout engines

All eight Graphviz layout engines are registered. Pass the name as the second
argument to `renderSvg`:

| Engine       | Layout style                                  |
|--------------|-----------------------------------------------|
| `dot`        | Hierarchical / layered directed graphs        |
| `neato`      | Spring-model (Kamada–Kawai)                   |
| `fdp`        | Force-directed                                |
| `sfdp`       | Multiscale force-directed (large graphs)      |
| `circo`      | Circular                                      |
| `twopi`      | Radial                                        |
| `osage`      | Clustered                                     |
| `patchwork`  | Squarified treemap                            |

`dot` receives the most fidelity attention because the primary consumer is
DOT-centric. Per-engine coverage against the C source is tracked in the
[port catalog](./plans/port-catalog/README.md).

## Browser usage

The library uses no Node-only APIs and is safe to bundle for the browser. One
caller-supplied hook may be required:

- **Image sizing.** When a graph references external images (e.g.
  `node [image="foo.png"]`), Graphviz needs each image's intrinsic dimensions.
  Because the library cannot read the filesystem, provide a sizer via
  `setImageSizer`:

  ```ts
  import { setImageSizer } from '@knowvah/dot-engine';

  setImageSizer((src) => ({ w: 64, h: 64 })); // return null if unknown
  ```

### Text measurement

Layout needs to know how wide each label is. By default this uses a **built-in,
deterministic metric model** — no font files, identical output on every platform.
In the **browser** the library automatically measures with the page's own canvas
(the same font the browser renders the SVG with).

For **host-faithful** Node measurement (real kerning/shaping, matching the local
fonts the SVG will be rendered with), install the optional `canvas` peer and wire
it once via `setTextMeasurer`:

```ts
import { setTextMeasurer, CanvasTextMeasurer } from '@knowvah/dot-engine';
import { createCanvas } from 'canvas'; // optional peer: `npm i canvas`

setTextMeasurer(new CanvasTextMeasurer(createCanvas(0, 0).getContext('2d')));
```

Trade-off: the built-in model is reproducible across machines; the host-faithful
path matches the rendering font but is platform-dependent (as native graphviz is).
See the Text measurement guide for the full contract.

## Security

**Treat rendered output as attacker-controlled markup whenever the DOT source is
untrusted.** The SVG and image-map strings this library produces embed graph
attribute values (labels, `id`, `class`, `href`/`URL`, `image`, `stylesheet`,
tooltips) directly. All such values are XML-escaped exactly as native Graphviz
does, so they cannot break out of an element or attribute — but, **matching
upstream Graphviz, the library does not filter URL schemes or validate resource
origins.** A DOT source you did not author can therefore contain:

- `href="javascript:…"` / `URL="javascript:…"` on a node or edge (executes on
  click),
- `image="…"` (usershape) or an image-map `href` pointing at an arbitrary
  external origin,
- a `stylesheet="…"` referencing an external CSS origin.

This is deliberate — scheme/origin policy belongs to the page embedding the
output, not to the layout library. If you render untrusted DOT and embed the
result inline (`innerHTML`, `dangerouslySetInnerHTML`, an inline `<svg>`), apply
a **Content-Security-Policy** on the host page as the control point:

- `script-src` (without `'unsafe-inline'`) — neutralizes `javascript:` hrefs and
  any inline event handlers,
- `img-src` — constrains `<image>` / usershape origins,
- `style-src` — constrains the `stylesheet` processing instruction.

If you cannot set a CSP, sanitize the returned markup (e.g. DOMPurify with an
SVG profile) before inserting it, or render from trusted DOT only.

## Public API

```ts
// Primary entry point. Throws a structured GvError (ParseError / RenderError).
function renderSvg(dotSource: string, engine: string): string;

// Result-style entry point: returns { svg } or { errors: [GvError] }, never throws.
function tryRenderSvg(dotSource: string, engine: string): RenderResult;

// Structured error contract (see "Error handling").
interface GvError { type; code; message; friendlyMessage; location?; expected?; }
interface RenderResult { svg?: string; errors?: GvError[]; }
type GvErrorType = 'syntax' | 'semantic' | 'render';
type GvErrorCode = 'SYNTAX_ERROR' | 'SYNTAX_UNEXPECTED_EOF' | /* …7 total */ 'GENERIC_ERROR';
class ParseError extends Error implements GvError { /* type:'syntax' */ }
class RenderError extends Error implements GvError { /* type:'render' */ }

// Parse DOT into the in-memory graph model (without laying it out).
function parse(dotSource: string): Graph;

// Supply intrinsic dimensions for external image references (browser/Node).
function setImageSizer(sizer: ImageSizer | null): void;
type ImageSizer = (src: string) => { w: number; h: number } | null;

// Multi-format render + structured xdot draw-ops (from `@knowvah/dot-engine/render`,
// also re-exported from the root package).
function render(g: Graph, format: OutputFormat, opts?: { engine?: string }): string;
function getDrawOps(g: Graph, opts?: { engine?: string }): XdotOp[];

// Programmatic graph construction and computed-geometry readback (from
// `@knowvah/dot-engine/api`, also re-exported from the root package) — build a graph
// without writing DOT source, or read back node/edge/bbox coordinates after
// layout.
function createGraph(opts?: CreateGraphOptions): GvGraphBuilder;
function addEdge(g: Graph, tail: Node, head: Node, name?: string): Edge;
function getLayout(g: Graph, opts?: { yAxis?: 'up' | 'down' }): LayoutSnapshot;

// Lower-level orchestration, for callers that need engine/render control.
class GvcContext { /* register engines/renderers, layout, render */ }
function renderWithContext(ctx: GvcContext, graph: Graph, format: string): string;
```

Most callers only need `renderSvg` (or `tryRenderSvg` for result-style error
handling). `parse`, `GvcContext`, and `renderWithContext` are exposed for
advanced use — e.g. inspecting the parsed model, or driving layout and
rendering as separate steps. `createGraph`/`addEdge`, `getLayout`, `render`,
and `getDrawOps` are the graph-building, geometry-readback, multi-format
render, and structured-draw-op surfaces respectively — see the
[API guide](https://knowvah.github.io/dot-engine/guide/api) for full
walkthroughs of each.

## Development

```bash
npm test            # run the test suite (vitest)
npm run coverage    # run with coverage (v8)
npm run typecheck   # tsc --noEmit, strict mode, zero errors required
npm run build       # bundle to dist/index.js
```

The test suite verifies port fidelity by comparing generated SVG against output
from the canonical C Graphviz. New behavior is pinned to the C source — see
[`CLAUDE.md`](./CLAUDE.md) for the porting rules and the
[port catalog](./plans/port-catalog/README.md) for status.

## Status & coverage

- **What works:** parsing, all eight layout engines, SVG output, and the
  intermediate `json` / `xdot` / `dot` / imagemap text formats.
- **Conformance bar:** a render is **conformant** when it matches the C oracle
  within a ±0.01 deterministic tolerance (`dot`, `circo`, `twopi`, `osage`,
  `patchwork`) or is characterized at a looser ±0.5 tolerance for the
  iterative force-directed engines (`neato`, `fdp`, `sfdp`) — never literal
  byte equality. Full definition: [Conformance](./docs/conformance.md).
- **Current parity** (fresh corpus sweeps, dated 2026-07-11 — see
  [`test/corpus/PARITY.md`](./test/corpus/PARITY.md) and the
  [docs-site parity pages](https://knowvah.github.io/dot-engine/engines) for
  live counts): `dot` SVG 762/788 conformant (+14 structural-match, 0
  unaccepted tracked gaps — every remaining non-conformant graph is a
  documented, accepted divergence); `dot` xdot 754/759; `circo` xdot 745/762;
  `twopi` xdot 740/762; `osage` xdot 744/759; `patchwork` xdot 757/762
  (all deterministic, ±0.01). `neato`/`fdp`/`sfdp` are characterized at ±0.5
  rather than gated at the deterministic bar, per the tolerance split above.
- **What's tracked:** every C algorithm and its port status is inventoried in
  the [port catalog](./plans/port-catalog/README.md). Items marked `[ ]` there
  are real gaps, not footnotes.
- **Known behavioral divergences from C** (differences investigated,
  root-caused, and deliberately not chased) are listed in
  [`docs/known-divergences.md`](./docs/known-divergences.md).

## Known limitations

- **Feature coverage is incomplete.** The C source defines completeness; gaps
  are tracked in the port catalog rather than hidden.

## License

[Eclipse Public License v2.0](https://www.eclipse.org/legal/epl-2.0/) (EPL-2.0),
matching [upstream Graphviz](https://gitlab.com/graphviz/graphviz). Every source file carries an
`SPDX-License-Identifier: EPL-2.0` header.
