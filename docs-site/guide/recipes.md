# Recipes

Task-oriented snippets for the parts of the build → layout → read-geometry
path that aren't obvious from the API reference alone. Each recipe is a
minimal, runnable example using only the public `graphviz-ts` /
`graphviz-ts/api` / `graphviz-ts/render` surface — no internal model classes.
See `/guide/api` for the full list of entry points these snippets draw from.

## 1. Build a graph in code and render it

```ts
import { createGraph, render } from 'graphviz-ts';

const b = createGraph({ directed: true });
b.addNode('client', { shape: 'box' });
b.addNode('server', { shape: 'box' });
b.addEdge('client', 'server', { label: 'HTTP GET' });

const svg = render(b.graph, 'svg');
```

**Why:** `createGraph` gives you a builder when your graph structure comes
from application data rather than a static DOT string; `render` lays the
graph out and serializes it in one call. Full builder API (subgraphs,
attributes, `parse` comparison) is in `/guide/build-a-graph`.

## 2. Lay out without rendering, then read the geometry

```ts
import { createGraph, render, getLayout } from 'graphviz-ts';

const b = createGraph({ directed: true });
b.addNode('a');
b.addNode('b');
b.addEdge('a', 'b');

// render() triggers layout as a side effect and leaves the computed
// geometry on the graph. Call it (or the lower-level ctx.layout) BEFORE
// getLayout(), even if you don't need render()'s return value.
render(b.graph, 'svg');

const layout = getLayout(b.graph);
for (const n of layout.nodes) {
  console.log(n.name, n.x, n.y, n.width, n.height);
}
```

**Why:** `getLayout` is a pure reader over already-computed geometry — it
does not run layout itself. Call it before any layout call runs and it
throws a `RenderError` ("getLayout requires a laid-out graph") rather than
handing back stale or zeroed coordinates. If you only need the geometry and
never need the rendered string, discard `render`'s return value — the
layout side effect is what you're actually paying for.

## 3. Choose the y-axis for your renderer

```ts
import { getLayout } from 'graphviz-ts';

// Screen/canvas/SVG convention: origin top-left, y increases downward.
const screenLayout = getLayout(g);

// Native graphviz convention: origin bottom-left, y increases upward.
const nativeLayout = getLayout(g, { yAxis: 'up' });
```

**Why:** graphviz computes layout in a y-up coordinate system; most
consumers (canvas, DOM, SVG-in-the-browser) want y-down. `getLayout`
defaults to `'down'` so most callers never need the option. See
`/guide/geometry` for the exact flip formula and how `bounds` differs
between the two modes.

## 4. Reconcile the `render()` SVG frame with the `getLayout()` frame

`render(g, 'svg')` and `getLayout(g)` describe the *same* laid-out graph but
in different coordinate frames, and the difference isn't just the y-axis
flip: `render`'s SVG emitter negates every y-coordinate before writing a
shape primitive, then wraps the whole drawing in one `<g transform="scale(..)
rotate(..) translate(tx,ty)">` that folds in graphviz's page padding,
margin, and any `size=`/rotation scaling. `getLayout` skips all of that — it
returns model coordinates normalized to a `(0, 0)` origin with no page
geometry at all.

For any single `render()` call, the two frames differ by one constant
translation. Rather than re-deriving GVC's page-layout formula, derive the
offset empirically from one node you already have positions for in both
frames:

```ts
import { createGraph, render, getLayout } from 'graphviz-ts';

const b = createGraph({ directed: true });
b.addNode('start');
b.addNode('end');
b.addEdge('start', 'end');

const svg = render(b.graph, 'svg');
const layout = getLayout(b.graph);

/** Bounding-box center of a `<g id="nodeN" class="node">` block's own
 *  `<polygon points="...">`, keyed by the node name in its `<title>`. */
function svgNodeCenter(svg: string, name: string): { x: number; y: number } | undefined {
  const block = new RegExp(
    `<g id="node\\d+" class="node">\\s*<title>${name}</title>([\\s\\S]*?)</g>`,
  ).exec(svg)?.[1];
  const pts = block !== undefined ? /points="([^"]+)"/.exec(block)?.[1] : undefined;
  if (pts === undefined) return undefined;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const pair of pts.trim().split(/\s+/)) {
    const [x, y] = pair.split(',').map(Number);
    xs.push(x ?? 0);
    ys.push(y ?? 0);
  }
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

const anchor = layout.nodes[0]!;
const rendered = svgNodeCenter(svg, anchor.name)!;
const offset = { dx: rendered.x - anchor.x, dy: rendered.y - anchor.y };

// offset is a pure translation for this render() call. Apply it to any
// other coordinate you scrape out of the same svg string to convert it
// into getLayout()'s frame:
// { x: scrapedX - offset.dx, y: scrapedY - offset.dy }
```

**Why:** one match fully determines the offset because it's a pure
translation, not a scale or rotation (assuming default `size=`/`rotate=`).
You only need this when you're reading something out of the raw SVG that
`getLayout` doesn't expose — see recipe 5 for the one common case where
that's unavoidable today.

## 5. Recover edge-label positions

```ts
import { createGraph, render, getLayout } from 'graphviz-ts';

const b = createGraph({ directed: true });
b.addNode('client');
b.addNode('server');
b.addEdge('client', 'server', { label: 'HTTP GET' });

render(b.graph, 'svg');
const layout = getLayout(b.graph);

for (const e of layout.edges) {
  if (e.label !== undefined) {
    console.log(`${e.tail} -> ${e.head} label center: (${e.label.x}, ${e.label.y})`);
  }
}
```

**Why:** `EdgeGeometry.label` is present only for an edge whose `label`
attribute graphviz actually placed a centered label for; edges without one
simply omit the field. `getLayout` returns only the computed *position* —
not the label string or its measured box — so if your renderer needs to
draw the label itself, pair this position with whatever size you already
measured for that label text on your own side (e.g. by echoing back your
own per-edge label-size map, keyed by the same tail/head pair you used to
build the edge).

## 6. Map graphviz-ts cluster names back to yours

```ts
import { createGraph, render, getLayout } from 'graphviz-ts';

const b = createGraph({ directed: true });

// graphviz only treats a subgraph as a cluster when its name starts with
// the literal prefix "cluster". Generate one synthetic name per caller
// cluster id and remember the reverse mapping before layout runs.
const idByName = new Map<string, string>();
function addCluster(id: string, label: string) {
  const name = `cluster${idByName.size}`;
  idByName.set(name, id);
  return b.addSubgraph(name, { label });
}

const web = addCluster('web-tier', 'Web');
web.addNode('lb');
web.addNode('app1');
web.addEdge('lb', 'app1');

b.addNode('db');
b.addEdge('app1', 'db');

render(b.graph, 'svg');
const layout = getLayout(b.graph);

const clustersByCallerId = new Map(
  layout.clusters.map((c) => [idByName.get(c.name) ?? c.name, c]),
);
// clustersByCallerId.get('web-tier') -> { name, x, y, width, height }
```

**Why:** `ClusterGeometry.name` echoes back exactly whatever name you gave
`addSubgraph` — graphviz-ts does not invent, renumber, or otherwise
transform it. If your domain model keys clusters by its own id (not a name
graphviz would accept), keep the id-to-name mapping yourself while building
the graph and re-key the `clusters` snapshot after layout; don't try to
recover meaning from graphviz's own name.

## 7. Add many edges safely

```ts
import { createGraph, render } from 'graphviz-ts';

const b = createGraph({ directed: true, strict: true });

const dependencies: Array<[string, string]> = [
  ['build', 'test'],
  ['test', 'deploy'],
  ['build', 'lint'],
  ['lint', 'test'],
  ['build', 'test'], // duplicate -- collapsed on a strict graph, not doubled
];

for (const [from, to] of dependencies) {
  b.addEdge(from, to);
}

const svg = render(b.graph, 'svg');
```

**Why:** the builder's `addEdge` resolves `tail`/`head` by name and creates
the node on first use if it doesn't exist yet — you never have to
pre-declare nodes before wiring up a data-driven edge list. On a `strict`
graph, repeating the same `(tail, head)` pair returns the existing edge
instead of adding a parallel one, mirroring cgraph's `agedge` dedup
contract.

If you're adding edges onto a graph produced by `parse()` rather than
`createGraph()`, use the lower-level `addEdge(g, tail, head, name?)` from
`graphviz-ts` directly on `Node` references you already hold:

```ts
import { parse, addEdge } from 'graphviz-ts';

const g = parse('digraph { a; b; }');
const a = g.nodes.get('a')!;
const c = g.nodes.get('b')!;
addEdge(g, a, c);
```

See `/reference` for the full `addEdge` signature and its strict-graph
dedup behavior.

## 8. Putting it together

A compact function that takes a small domain graph, lays it out, and
returns positioned nodes and edges:

```ts
import { createGraph, render, getLayout } from 'graphviz-ts';
import type { LayoutSnapshot } from 'graphviz-ts';

interface DomainNode {
  id: string;
  label: string;
}

interface DomainEdge {
  from: string;
  to: string;
  label?: string;
}

interface PositionedGraph {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{
    from: string;
    to: string;
    points: { x: number; y: number }[];
    label?: { x: number; y: number };
  }>;
  width: number;
  height: number;
}

function layoutDomainGraph(nodes: DomainNode[], edges: DomainEdge[]): PositionedGraph {
  const b = createGraph({ directed: true });
  for (const n of nodes) b.addNode(n.id, { label: n.label });
  for (const e of edges) {
    b.addEdge(e.from, e.to, e.label !== undefined ? { label: e.label } : {});
  }

  // render() triggers layout; getLayout() reads the geometry it left behind.
  render(b.graph, 'svg');
  const snap: LayoutSnapshot = getLayout(b.graph);

  return {
    nodes: snap.nodes.map((n) => ({
      id: n.name,
      // graphviz reports the node CENTER; convert to top-left if your
      // renderer expects that instead.
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
      width: n.width,
      height: n.height,
    })),
    edges: snap.edges.map((e) => ({
      from: e.tail,
      to: e.head,
      points: e.points,
      ...(e.label !== undefined ? { label: e.label } : {}),
    })),
    width: snap.bounds.width,
    height: snap.bounds.height,
  };
}
```

This is the shape most consumers end up building on top of `getLayout`: one
seam that takes your own node/edge types in, and returns positioned
geometry in your own coordinate convention out.
