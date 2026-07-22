# Migrating from the `dot` command-line tool

The C `dot`/`neato`/`fdp`/... binaries read a `.dot` file (or stdin) and write
a rendered file (or stdout). graphviz-ts has no filesystem: it takes a DOT
**string** in and returns a rendered **string** out (or, with `getLayout`, a
plain JavaScript geometry object instead of a string to parse).

```bash
dot -Kneato -Tsvg input.dot -o output.svg
```

```ts
import { renderSvg } from 'graphviz-ts';
import { readFileSync, writeFileSync } from 'node:fs';

const dot = readFileSync('input.dot', 'utf8');
const svg = renderSvg(dot, 'neato');
writeFileSync('output.svg', svg);
```

The file reads/writes above are your code, not the library's — graphviz-ts
never touches disk. That's also what makes it work unmodified in a browser
tab with no `input.dot` to read.

## `-K<engine>` — the layout engine

`-K` selects the layout engine; graphviz-ts takes the same name as the
`engine` argument to `renderSvg` or the `opts.engine` field of `render`. All
eight engines are ported:

| `-K` value | graphviz-ts `engine` string |
|---|---|
| `-Kdot` | `'dot'` (also the default for `render` when `engine` is omitted) |
| `-Kneato` | `'neato'` |
| `-Kfdp` | `'fdp'` |
| `-Ksfdp` | `'sfdp'` |
| `-Kcirco` | `'circo'` |
| `-Ktwopi` | `'twopi'` |
| `-Kosage` | `'osage'` |
| `-Kpatchwork` | `'patchwork'` |

```ts
renderSvg(dot, 'neato');
render(g, 'svg', { engine: 'neato' });
```

See [Layout engines](/guide/engines) for what each one does and its
conformance class.

## `-T<format>` — the output format

`renderSvg` is SVG-only; use `render(g, format, opts?)` for anything else.
graphviz-ts's `OutputFormat` union covers these `-T` targets:

| `-T` value | graphviz-ts `format` string | Notes |
|---|---|---|
| `-Tsvg` | `'svg'` | also `renderSvg`'s only output |
| `-Tdot` | `'dot'` | DOT source with layout attributes (`pos`, `bb`, ...) added |
| `-Txdot` | `'xdot'` | DOT + `_draw_`/`_ldraw_` xdot instructions |
| `-Tjson` | `'json'` | full graph as JSON |
| `-Tplain` | `'plain'` | whitespace-separated node/edge geometry |
| `-Tplain-ext` | `'plain-ext'` | `plain`, plus port coordinates on edges |
| `-Timap` | `'imap'` | server-side HTML image map |
| `-Tcmapx` | `'cmapx'` | client-side HTML `<map>` element |

```ts
const svg = render(g, 'svg', { engine: 'dot' });
const json = render(g, 'json');
```

**Not supported:** raster formats (`-Tpng`, `-Tjpg`, `-Tgif`, ...),
`-Tps`/`-Tpdf`/`-Teps`, and GUI/interactive backends. These are an
intentional scope boundary — see [Known divergences](/divergences) for the
full non-goals list. If you need a raster, render to `'svg'` and convert
downstream (a headless browser, `resvg`, or similar).

## `-Gname=val` / `-Nname=val` / `-Ename=val` — attributes

The CLI's global attribute flags set a default on every graph/node/edge from
the command line. graphviz-ts has no command-line flags — set the same
attributes directly in the DOT source, or via the builder API if you're
constructing the graph in code:

```bash
dot -Gsize=6,6 -Nshape=box -Ecolor=blue -Tsvg input.dot
```

```ts
// DOT source — put the defaults in a top-level attribute statement
const dot = `
  digraph {
    graph [size="6,6"];
    node  [shape=box];
    edge  [color=blue];
    a -> b;
  }
`;
const svg = renderSvg(dot, 'dot');
```

```ts
// Builder — set per-node/per-edge attrs where you create each one
import { createGraph, render } from 'graphviz-ts';

const b = createGraph({ directed: true });
b.setAttr('size', '6,6');
b.addNode('a', { shape: 'box' });
b.addNode('b', { shape: 'box' });
b.addEdge('a', 'b', { color: 'blue' });
const svg = render(b.graph, 'svg');
```

See [Build a graph in code](/guide/build-a-graph) for the full builder API.

## Getting geometry the CLI can't give you directly

`-Tplain` exists precisely so scripts can scrape node/edge coordinates out of
text output. graphviz-ts skips the round-trip: call `getLayout(g)` after
`render` to get a typed, JSON-serializable snapshot of every node position,
edge spline, and the overall bounding box — no text format to parse.

```ts
import { createGraph, render, getLayout } from 'graphviz-ts';

const b = createGraph({ directed: true });
b.addNode('a');
b.addNode('b');
b.addEdge('a', 'b');

render(b.graph, 'svg');
const layout = getLayout(b.graph);
// layout.nodes[0] → { name: 'a', x, y, width, height }
```

See [Read computed geometry](/guide/geometry) for the full snapshot shape and
the `yAxis` option (native graphviz is y-up; browsers are y-down).

## Fonts and images: the CLI reads your filesystem, graphviz-ts doesn't

Native `dot` measures text with whatever fonts are installed on the machine,
and resolves `image="..."` attributes by reading files relative to the
working directory. graphviz-ts has no filesystem access, so both are
injected by the host application instead of read from disk:

- **Text measurement** — `setTextMeasurer` installs a `TextMeasurer`; the
  library resolves a sensible default automatically (browser canvas, or a
  deterministic metric model in Node) if you don't set one. See
  [Text measurement](/guide/text-measurement).
- **Images** — `setImageSizer` (and `setImageResolver` for inlining) let you
  supply intrinsic image dimensions and image data yourself, since
  graphviz-ts cannot stat a file on your behalf. See
  [Working with images](/guide/images).

## See also

- [Layout engines](/guide/engines)
- [Render to other formats](/guide/render-formats)
- [Read computed geometry](/guide/geometry)
- [Known divergences](/divergences)
- [Getting started](/guide/getting-started)
