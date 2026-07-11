<!-- SPDX-License-Identifier: EPL-2.0 -->

# graphviz-ts

A faithful TypeScript port of [Graphviz](https://gitlab.com/graphviz/graphviz) — the
graph-visualization toolkit originally written in C at AT&T Research and Lucent
Bell Labs. It parses the DOT language, runs Graphviz's layout engines, and emits
SVG.

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

> **Status: `0.1.0` — in active development.** The port is mature enough to lay
> out and render real graphs across all engines, but it is not yet published to
> npm and the C feature surface is not 100% covered. The `dot` engine is the
> primary fidelity target. See [Status & coverage](#status--coverage) below.

## Why this exists

Existing ways to render DOT in a JS environment shell out to a Graphviz
binary, a rendering server, or a WASM build — none of which run everywhere a
browser does, and all of which add deployment friction. graphviz-ts removes
that dependency entirely: the layout engine *is* TypeScript.

## Install

```bash
npm i graphviz-ts
```

Ships as ESM bundles with TypeScript declarations, zero runtime dependencies.
Entry points: `graphviz-ts` (core), `graphviz-ts/api` (graph-building API),
`graphviz-ts/render` (renderers).

To build from source instead: clone, `npm install`, `npm run build`
(esbuild bundles + `.d.ts` declarations into `dist/`).

## Quick start

```ts
import { renderSvg } from 'graphviz-ts';

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
import { tryRenderSvg } from 'graphviz-ts';

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
  import { setImageSizer } from 'graphviz-ts';

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
import { setTextMeasurer, CanvasTextMeasurer } from 'graphviz-ts';
import { createCanvas } from 'canvas'; // optional peer: `npm i canvas`

setTextMeasurer(new CanvasTextMeasurer(createCanvas(0, 0).getContext('2d')));
```

Trade-off: the built-in model is reproducible across machines; the host-faithful
path matches the rendering font but is platform-dependent (as native graphviz is).
See the Text measurement guide for the full contract.

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

// Lower-level orchestration, for callers that need engine/render control.
class GvcContext { /* register engines/renderers, layout, render */ }
function render(ctx: GvcContext, graph: Graph, format: string): string;
```

Most callers only need `renderSvg` (or `tryRenderSvg` for result-style error
handling). `parse`, `GvcContext`, and `render` are exposed for advanced use —
e.g. inspecting the parsed model, or driving layout and rendering as separate
steps.

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
- **What's tracked:** every C algorithm and its port status is inventoried in
  the [port catalog](./plans/port-catalog/README.md). Items marked `[ ]` there
  are real gaps, not footnotes.
- **Known behavioral divergences from C** (where output differs in a documented,
  bounded way) are listed in [`docs/known-divergences.md`](./docs/known-divergences.md).

## Known limitations

- **Feature coverage is incomplete.** The C source defines completeness; gaps
  are tracked in the port catalog rather than hidden.

## License

[Eclipse Public License v2.0](https://www.eclipse.org/legal/epl-2.0/) (EPL-2.0),
matching [upstream Graphviz](https://gitlab.com/graphviz/graphviz). Every source file carries an
`SPDX-License-Identifier: EPL-2.0` header.
