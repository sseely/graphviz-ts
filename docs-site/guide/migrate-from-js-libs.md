# Migrating from other JS Graphviz libraries

viz.js / `@viz-js/viz`, `@hpcc-js/wasm` (`@hpcc-js/wasm-graphviz`), and
`d3-graphviz` all give JavaScript access to Graphviz by compiling the real C
Graphviz to **WebAssembly** and calling into it. graphviz-ts is a from-scratch
**TypeScript port** — the layout engines, parser, and SVG emitter are
TypeScript source, not a compiled binary.

That difference is the headline, not a footnote:

| | WASM wrappers (viz.js / `@hpcc-js/wasm` / d3-graphviz) | graphviz-ts |
|---|---|---|
| Implementation | Real C Graphviz, compiled to a `.wasm` binary | Pure TypeScript port, no compiled artifact |
| Module init | Async — instantiate/await the WASM module before first use | None — `import` and call synchronously |
| Bundle | Ship a `.wasm` asset (hundreds of KB–low MB) alongside JS | JS only, tree-shakeable |
| Debugging | Step through a WASM blob (or C source, if you have it) | Step through the real TypeScript with source maps |
| Threading model | Some builds run layout in a Web Worker | Runs on the calling thread, like any TS function |
| Output formats | Whatever the underlying C build was compiled with — typically the full Graphviz set, including raster/PDF | SVG + the DOT/json/xdot/plain/imagemap text formats — see below |

If your use case is "call a function, get SVG back, no async ceremony, no
WASM asset to host" — that's what graphviz-ts is for. If your use case
depends on raster or PDF output, see [When to stay on WASM](#when-to-stay-on-wasm)
below.

## API deltas

The three libraries have different shapes; the table below is the common
migration case (approximate — verify against each library's own docs; see
citations below each row).

| Library | Typical call | graphviz-ts equivalent |
|---|---|---|
| `@viz-js/viz` (successor to viz.js) | `Viz.instance().then(viz => viz.renderSVGElement(dot))` — async, `Viz.instance()` resolves a Promise | `renderSvg(dot, 'dot')` — synchronous, no instance/init step |
| viz.js 2.x (legacy, `new Viz()`) | `new Viz().renderString(dot)` — returns a `Promise<string>` | `renderSvg(dot, 'dot')` — synchronous |
| `@hpcc-js/wasm-graphviz` | `await Graphviz.load()` once, then `graphviz.dot(dot)` (sync after load) | `renderSvg(dot, engine)` — no load/warm-up step at all |
| `d3-graphviz` | `d3.select(sel).graphviz().renderDot(dot)` — binds output into the DOM, animates transitions | `renderSvg(dot, engine)` returns an SVG **string**; you insert it into the DOM yourself (e.g. `el.innerHTML = svg`) |

Every graphviz-ts call in the right column is **synchronous** — there is no
module to await, because there's no WASM binary to instantiate. Drop any
`await`/`.then()` wrapping a graphviz-ts call; it was never needed.

- `@viz-js/viz`'s `Viz.instance()` → Promise and `renderSVGElement()` method
  are documented at viz-js.com; confirmed via the project's published usage
  example as of writing.
- viz.js 2.x's `new Viz().renderString(dot)` is the API documented for that
  (now-superseded) release line; if you're on a current install, check
  whether you're actually on `@viz-js/viz`.
- `@hpcc-js/wasm-graphviz`'s `Graphviz.load()` / `graphviz.dot()` pair is
  confirmed via the package's published usage example as of writing. The
  separate, older `@hpcc-js/wasm` package additionally exposed a
  `graphviz.layout(dot, format, engine)` call in past releases — check your
  installed version's own docs before relying on the exact signature.
- `d3-graphviz`'s `.graphviz().renderDot(dot)` chain, and that it is built on
  `@hpcc-js/wasm` internally, is confirmed via the project's published README
  as of writing.

### `renderDot`'s DOM binding is out of scope here

`d3-graphviz` does more than render SVG: it binds the result into a D3
selection, diffs re-renders, and animates transitions between layouts.
graphviz-ts has no DOM opinion at all — `renderSvg`/`render` return a plain
string. If you want d3-graphviz-style animated transitions between two
layouts, that's logic you'd build on top of two `renderSvg` calls and your
own DOM diffing (or keep using d3-graphviz for that specific feature — see
below).

## Getting layout data without parsing a string format

All three WASM libraries can be asked for Graphviz's own JSON or plain text
formats, then you parse that string yourself to get node/edge coordinates.
graphviz-ts skips the text round-trip: call `getLayout(g)` (after `render`)
for a typed, JSON-serializable snapshot directly — no `-Tjson`/`-Tplain`
string to parse.

```ts
import { createGraph, render, getLayout } from 'graphviz-ts';

const b = createGraph({ directed: true });
b.addNode('a');
b.addNode('b');
b.addEdge('a', 'b');

render(b.graph, 'svg');
const layout = getLayout(b.graph);
// layout.nodes  → [{ name: 'a', x, y, width, height }, ...]
// layout.edges  → [{ tail: 'a', head: 'b', points: [...] }]
// layout.bounds → { x, y, width, height }
```

See [Read computed geometry](/guide/geometry) for the full snapshot shape,
units, and the `yAxis` option.

## When to stay on WASM

Be honest with yourself about scope: graphviz-ts targets SVG plus the
`dot`/`xdot`/`json`/`plain`/`plain-ext`/`imap`/`cmapx` text formats. It does
**not** emit raster formats (PNG/JPEG/GIF/...) or PostScript/PDF/EPS — those
are an intentional scope boundary, not a gap that's merely unfinished. See
[Known divergences](/divergences) for the exact non-goals list.

If your application needs `-Tpng` or `-Tpdf` output directly from the layout
engine, the WASM-based libraries above still cover that case — because
they're running the real C Graphviz, they support whatever output formats
that build was compiled with. In that scenario, either keep using the WASM
library for that one code path, or render to `'svg'` with graphviz-ts and
convert the SVG to a raster/PDF downstream with a separate tool.

## See also

- [Layout engines](/guide/engines)
- [Render to other formats](/guide/render-formats)
- [Read computed geometry](/guide/geometry)
- [Known divergences](/divergences)
- [Getting started](/guide/getting-started)
