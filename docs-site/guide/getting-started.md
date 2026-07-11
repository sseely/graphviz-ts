# Getting started

graphviz-ts is a faithful TypeScript port of [Graphviz](https://graphviz.org/).
It parses the DOT language, runs Graphviz's layout engines, and emits SVG — in
pure TypeScript — no C: no native Graphviz binary and no WASM port.

## Install

graphviz-ts is published on npm:

```bash
npm i graphviz-ts
```

Zero runtime dependencies. The `canvas` package is an optional peer
dependency, only needed for host-faithful text measurement in Node — see
[Text measurement](/guide/text-measurement). The package ships three entry
points (`graphviz-ts`, `graphviz-ts/api`, `graphviz-ts/render`), each with
its own `.d.ts` type declarations, declaration maps, and source maps — "go to
definition" jumps into the real TypeScript source, which ships alongside the
build.

To build from source instead:

```bash
git clone https://github.com/sseely/graphviz-ts.git
cd graphviz-ts
npm install
npm run build        # → dist/index.js (ESM bundle, via esbuild) + .d.ts
```

## Render a graph

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

`renderSvg(dotSource, engine)` parses the DOT source, runs the named
[layout engine](/guide/engines), renders to SVG, and returns the SVG string.

## Next steps

- [Layout engines](/guide/engines) — the eight engines and when to use each.
- [Browser usage](/guide/browser) — bundling and the `setImageSizer` hook.
- [API reference](/guide/api) — the full public surface.
- [Playground](/playground) — edit DOT and see SVG live, in your browser.
