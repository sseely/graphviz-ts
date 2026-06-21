# Read computed geometry

`getLayout` returns a plain, JSON-serializable snapshot of the graph's computed
node positions, edge spline points, and bounding box — after layout has run.

## Basic usage

```ts
import { createGraph, render, getLayout } from 'graphviz-ts';

const b = createGraph({ directed: true });
b.addNode('a');
b.addNode('b');
b.addEdge('a', 'b');

// render runs layout and mutates the graph in place.
// Geometry is retained on the graph after render returns.
render(b.graph, 'svg');

const layout = getLayout(b.graph);
// layout.bounds  → { x: 0, y: 0, width: ..., height: ... }
// layout.nodes   → [{ name: 'a', x: ..., y: ..., width: ..., height: ... }, ...]
// layout.edges   → [{ tail: 'a', head: 'b', points: [{x,y}, ...] }]
```

`render` lays out the graph before rendering. The computed geometry (`coord`,
`width`, `height` on each node; spline `points` on each edge) is retained on
the graph object after `render` returns and is readable via `getLayout`.

## Snapshot shape

```ts
interface LayoutSnapshot {
  bounds: BoundsGeometry;          // overall bounding box
  nodes:  NodeGeometry[];          // one entry per node
  edges:  EdgeGeometry[];          // one entry per edge
}

interface BoundsGeometry {
  x: number; y: number;            // origin (0,0 in y-down mode)
  width: number; height: number;   // in points
}

interface NodeGeometry {
  name:   string;
  x:      number;   // centre x, in points
  y:      number;   // centre y, in points
  width:  number;   // in points (converted from model inches × 72)
  height: number;   // in points (converted from model inches × 72)
}

interface EdgeGeometry {
  tail:    string;
  head:    string;
  points:  { x: number; y: number }[];  // bezier control points, in points
  label?:  { x: number; y: number };    // centre label position (if present)
}
```

## Units

All coordinates and dimensions are in **points** (1 inch = 72 points),
matching graphviz's native unit.

Node `width` and `height` are stored internally in inches on the model;
`getLayout` converts them to points before returning.

## Coordinate system (`yAxis`)

graphviz's native coordinate system is y-up (origin at the lower-left corner).
Screen and browser contexts use y-down (origin at the upper-left corner).

```ts
// Default: y-down — origin top-left, y increases downward (screen convention)
const screen = getLayout(g);

// y-up — native graphviz coordinates, origin bottom-left
const native = getLayout(g, { yAxis: 'up' });
```

| `yAxis` | Origin | y direction | Use when |
|---|---|---|---|
| `'down'` (default) | top-left | increases downward | canvas, SVG, HTML |
| `'up'` | bottom-left | increases upward | native graphviz output, PDF |

In y-down mode the `bounds` origin is normalised to `(0, 0)`. In y-up mode
`bounds.x` and `bounds.y` reflect the raw lower-left corner of the graph
bounding box.

## Signature

```ts
function getLayout(g: Graph, opts?: { yAxis?: 'up' | 'down' }): LayoutSnapshot;
```

`getLayout` does not modify the graph. Call it as many times as needed after
layout.
