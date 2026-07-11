# Custom rendering with xdot draw-ops

`getDrawOps` lays out a graph, renders it to xdot format, and returns a flat
array of typed draw operations. Use it to drive a custom renderer (canvas,
WebGL, PDF, native UI) without parsing SVG.

## Signature

```ts
function getDrawOps(g: Graph, opts?: { engine?: string }): XdotOp[];
```

## Basic usage

```ts
import { createGraph, getDrawOps } from 'graphviz-ts';

const b = createGraph({ directed: true });
b.addNode('a', { shape: 'ellipse', label: 'Start' });
b.addNode('b', { shape: 'box',     label: 'End'   });
b.addEdge('a', 'b');

const ops = getDrawOps(b.graph);

for (const op of ops) {
  switch (op.kind) {
    case 'fill_color':
      // set fill color before drawing a filled shape
      setFillColor(op.color);
      break;
    case 'pen_color':
      setStrokeColor(op.color);
      break;
    case 'font':
      setFont(op.font.name, op.font.size);
      break;
    case 'filled_ellipse':
      fillEllipse(op.ellipse.x, op.ellipse.y, op.ellipse.w, op.ellipse.h);
      break;
    case 'unfilled_ellipse':
      strokeEllipse(op.ellipse.x, op.ellipse.y, op.ellipse.w, op.ellipse.h);
      break;
    case 'filled_polygon':
      fillPolygon(op.polygon.pts);
      break;
    case 'unfilled_polygon':
      strokePolygon(op.polygon.pts);
      break;
    case 'text':
      drawText(op.text.x, op.text.y, op.text.text, op.text.align);
      break;
  }
}
```

## Op kinds

The `XdotOp` union discriminates on `op.kind`:

| `kind` | Payload field | Description |
|---|---|---|
| `'filled_ellipse'` | `op.ellipse: XdotRect` | Fill an ellipse |
| `'unfilled_ellipse'` | `op.ellipse: XdotRect` | Stroke an ellipse |
| `'filled_polygon'` | `op.polygon: XdotPolyline` | Fill a closed polygon |
| `'unfilled_polygon'` | `op.polygon: XdotPolyline` | Stroke a closed polygon |
| `'filled_bezier'` | `op.bezier: XdotPolyline` | Fill a closed bezier curve |
| `'unfilled_bezier'` | `op.bezier: XdotPolyline` | Stroke an open bezier curve |
| `'polyline'` | `op.polyline: XdotPolyline` | Draw a polyline |
| `'text'` | `op.text: XdotText` | Draw a text label |
| `'fill_color'` | `op.color: string` | Set current fill color |
| `'pen_color'` | `op.color: string` | Set current stroke color |
| `'grad_fill_color'` | `op.gradColor: XdotColor` | Set gradient fill |
| `'grad_pen_color'` | `op.gradColor: XdotColor` | Set gradient stroke |
| `'font'` | `op.font: XdotFont` | Set current font |
| `'style'` | `op.style: string` | Set current draw style |
| `'image'` | `op.image: XdotImage` | Draw an embedded image |
| `'fontchar'` | `op.fontchar: number` | Set font char bitmask |

### Key types

```ts
interface XdotRect     { x: number; y: number; w: number; h: number }
interface XdotPolyline { pts: XdotPoint[] }
interface XdotPoint    { x: number; y: number; z: number }
interface XdotText     { x: number; y: number; align: 'left'|'center'|'right'; width: number; text: string }
interface XdotFont     { size: number; name: string }
```

## Coordinates

xdot coordinates are in **points**, in graphviz's native y-up frame (origin
at the lower-left). Flip y coordinates before drawing on a y-down surface:

```ts
// In y-down canvas rendering, where canvasHeight is bounds.height from getLayout:
const screenY = canvasHeight - op.ellipse.y;
```

Ops arrive in paint order: graph background first, then nodes, then edges.

## Coverage

`getDrawOps` surfaces the full paint-order op stream for a graph, including:
- Node shape ops (`filled_ellipse`, `filled_polygon`, `unfilled_polygon`, etc.)
- Text and label ops (`text`)
- Font ops (`font`)
- Color-setting ops (`fill_color`, `pen_color`), including custom node
  `color`/`fillcolor` attributes
- Edge draw ops (`unfilled_bezier` for the spline, plus `pen_color` /
  `fill_color` / `filled_polygon` for the arrowhead)

For `digraph { a [color=red]; a -> b }`, the `_draw_`/`_hdraw_` geometry and
color values match native `dot -Txdot` exactly (node ellipse, edge spline,
arrowhead polygon, and the applied `color=red`). Call `getDrawOps(g)` directly
on a fresh (not-yet-rendered) graph — calling `render(g, ...)` and
`getDrawOps(g)` on the *same* graph object runs layout twice and is not a
supported pattern; use one or the other per graph.

## Canvas example (node labels only)

```ts
import { parse, getDrawOps } from 'graphviz-ts';

const g = parse(`digraph { a [label="A"]; b [label="B"]; a -> b }`);
const ops = getDrawOps(g);

// Draw on an HTML canvas
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;

let font = '14px sans-serif';
for (const op of ops) {
  if (op.kind === 'font') {
    font = `${op.font.size}px ${op.font.name}`;
  } else if (op.kind === 'text') {
    ctx.font = font;
    ctx.fillText(op.text.text, op.text.x, canvas.height - op.text.y);
  } else if (op.kind === 'filled_ellipse') {
    ctx.beginPath();
    ctx.ellipse(
      op.ellipse.x, canvas.height - op.ellipse.y,
      op.ellipse.w / 2, op.ellipse.h / 2,
      0, 0, 2 * Math.PI,
    );
    ctx.fill();
  }
}
```
