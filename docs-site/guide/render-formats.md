# Render to other formats

`render` lays out a graph and emits a string in the requested format. It
accepts any `Graph` produced by `parse` or `createGraph`.

## Signature

```ts
function render(
  g:      Graph,
  format: OutputFormat,
  opts?:  { engine?: string },
): string;
```

`engine` defaults to `'dot'`. See [Layout engines](/guide/engines) for the full
list.

## Formats

```ts
type OutputFormat =
  | 'svg'        // SVG markup
  | 'dot'        // DOT source with layout attributes added
  | 'xdot'       // DOT + xdot draw instructions (_draw_ attributes)
  | 'json'       // Full graph as JSON (graphviz json format)
  | 'plain'      // Whitespace-separated node/edge geometry (plain text)
  | 'plain-ext'  // plain, extended with port info
  | 'imap'       // HTML image-map (server-side; clickable areas)
  | 'cmapx';     // HTML client-side image-map
```

## When to use each

| Format | Typical use |
|---|---|
| `'svg'` | Embed in web pages; human-readable; scales losslessly |
| `'dot'` | Debugging; re-feed to other graphviz tools with layout preserved |
| `'xdot'` | Feed to a custom renderer via `getDrawOps` |
| `'json'` | Machine-readable graph data for tooling or inspection |
| `'plain'` | Lightweight geometry output; easy to parse in scripts |
| `'plain-ext'` | Like `'plain'`, plus port coordinates on edges |
| `'imap'` | Server-side clickable image map for `<img>` tags |
| `'cmapx'` | Client-side `<map>` element for `<img>` tags |

## Examples

```ts
import { parse, render } from '@knowvah/dot-engine';

const g = parse(`
  digraph {
    rankdir = LR;
    a [label="Node A"];
    b [label="Node B"];
    a -> b [label="edge"];
  }
`);

// SVG — most common output
const svg = render(g, 'svg');

// Annotated DOT (layout coordinates embedded)
const laid = render(g, 'dot');

// JSON for inspection
const json = render(g, 'json');

// Plain-text geometry
const plain = render(g, 'plain');
```

## Using a different engine

```ts
import { createGraph, render } from '@knowvah/dot-engine';

const b = createGraph({ directed: false });
b.addNode('x'); b.addNode('y'); b.addNode('z');
b.addEdge('x', 'y'); b.addEdge('y', 'z'); b.addEdge('z', 'x');

// neato uses a spring-model layout
const svg = render(b.graph, 'svg', { engine: 'neato' });
```

## Relationship to `renderSvg`

`renderSvg(dot, engine)` is a convenience wrapper that calls `parse` + `render`
in one step and is limited to SVG output. Use `render` directly when you need a
non-SVG format or when you already hold a `Graph` object.

```ts
// Equivalent
const svg1 = renderSvg(dotSource, 'dot');

const svg2 = render(parse(dotSource), 'svg', { engine: 'dot' });
```
