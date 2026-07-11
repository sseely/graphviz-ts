# Getting started

graphviz-ts is a faithful TypeScript port of [Graphviz](https://graphviz.org/).
It parses the DOT language, runs Graphviz's layout engines, and emits SVG — in
pure TypeScript — no C: no native Graphviz binary and no WASM port.

## Install & build

The library is not yet published to npm. For now, clone and build:

```bash
git clone https://github.com/sseely/graphviz-ts.git
cd graphviz-ts
npm install
npm run build        # → dist/index.js (ESM bundle, via esbuild)
```

`npm run build` produces a single bundled ES module at `dist/index.js`.

::: tip Type declarations
The build does not yet emit `.d.ts` declarations, and no package entry points
(`main`/`module`/`types`/`exports`) are declared. Both are tracked follow-ups
before a `1.0` consumer release. See [Known divergences](/divergences).
:::

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
