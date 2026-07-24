# Getting started

@knowvah/dot-engine is a faithful TypeScript port of [Graphviz](https://graphviz.org/).
It parses the DOT language, runs Graphviz's layout engines, and emits SVG — in
pure TypeScript — no C: no native Graphviz binary and no WASM port.

::: tip New to the library?
Read the [Overview](/guide/overview) first — it maps the pipeline
(parse/build → layout → render / read-geometry) and the three entry points
(`@knowvah/dot-engine`, `@knowvah/dot-engine/api`, `@knowvah/dot-engine/render`) so you know which
door to use before you install.
:::

## Install

@knowvah/dot-engine is published on npm:

```bash
npm i @knowvah/dot-engine
```

Zero runtime dependencies. The `canvas` package is an optional peer
dependency, only needed for host-faithful text measurement in Node — see
[Text measurement](/guide/text-measurement). The package ships three entry
points (`@knowvah/dot-engine`, `@knowvah/dot-engine/api`, `@knowvah/dot-engine/render`), each with
its own `.d.ts` type declarations, declaration maps, and source maps — "go to
definition" jumps into the real TypeScript source, which ships alongside the
build.

To build from source instead:

```bash
git clone https://github.com/knowvah/dot-engine.git
cd @knowvah/dot-engine
npm install
npm run build        # → dist/index.js (ESM bundle, via esbuild) + .d.ts
```

## Render a graph

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

`renderSvg(dotSource, engine)` parses the DOT source, runs the named
[layout engine](/guide/engines), renders to SVG, and returns the SVG string.

New to DOT? It is a small plain-text language for describing graphs — the
canonical **[DOT language reference](https://graphviz.org/doc/info/lang.html)** is
the syntax guide, and [Overview](/guide/overview#what-is-dot-what-is-graphviz)
has a one-paragraph primer.

## Next steps

- [Overview](/guide/overview) — the mental model and the three entry points.
- [Layout engines](/guide/engines) — the eight engines and when to use each.
- [Build a graph in code](/guide/build-a-graph) — the `createGraph` builder.
- [Recipes](/guide/recipes) — task-oriented, runnable solutions.
- [Read computed geometry](/guide/geometry) — positions and splines via
  `getLayout`.
- [Working with images](/guide/images) — inlining, deployment, and CSP.
- [Types](/guide/types) — the public data shapes and how they relate.
- [Browser usage](/guide/browser) — bundling and the `setImageSizer` hook.
- [API reference](/guide/api) — the full public surface.
- [Playground](/playground) — edit DOT and see SVG live, in your browser.
