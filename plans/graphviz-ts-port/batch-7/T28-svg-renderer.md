# T28 — SVG Renderer

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC.

T28 ports `plugin/core/gvrender_core_svg.c` (~800 lines). The SVG renderer is
the primary output target for the entire project and the principal vehicle for
verifying that layout algorithms produce correct results.

### Critical: Y-axis coordinate flip

Graphviz's internal coordinate system has origin at **lower-left** with Y
increasing upward (PostScript convention). SVG has origin at **upper-left**
with Y increasing downward. The C code applies this flip in `svg_bzptarray`
using `-A[i].y` (see line 76 of `gvrender_core_svg.c`), and similar negations
appear at every other Y-coordinate emit site.

The rule: **at every site where a Y coordinate is written to the SVG output
buffer, apply `y_svg = graphHeightPt - y_xdot`**. Every such site must carry
the comment:

```typescript
// Y-flip: PS origin bottom-left → SVG origin top-left
```

`graphHeightPt` is `job.bb.ur.y - job.bb.ll.y` (the graph bounding box
height in points, available on the `RenderJob`).

The C implementation uses `gvrender_ptf` (called by gvrender.c dispatch layer)
to pre-transform coordinates before passing them to the renderer callbacks.
After `transformPoint` is applied, the Y coordinates passed to SVG renderer
callbacks already have the sign flipped (because `devscale.y = -1` for SVG).
So the actual implementation is: use pre-transformed coordinates as-is from
`job` — no additional negation needed inside the renderer callbacks themselves,
because the transformation is already applied upstream in `renderGraph`. The
Y-flip comment belongs at the `devscale.y = -1` initialization site in
`src/gvc/device.ts`, not inside `svg.ts` callback methods.

However, `svg_bzptarray` in the C source does `-A[i].y` directly, which
suggests the SVG renderer in C receives *already-negated* Y from
`gvrender_ptf`. Confirm this by reading the full source file before
implementing. Document your finding in the commit message.

### SVG coordinate system note (from C source comment, line 11–18)

> The initial `<svg>` element defines the SVG coordinate system so that the
> graphviz canvas (in units of points) fits the intended absolute size in
> inches. After this, `px == pt` in SVG, so units can be omitted. Font sizes
> from the graph are preserved without scaling as long as graph size was not
> constrained.

This means: the `<svg width="...pt" height="...pt" viewBox="...">` element
must set `width` and `height` in points. The `viewBox` must match.

### Format IDs

The C source defines three format IDs in an anonymous enum:

```c
enum { FORMAT_SVG, FORMAT_SVGZ, FORMAT_SVGZ_INLINE };
```

TypeScript: implement `FORMAT_SVG` (standalone SVG file) only. `FORMAT_SVGZ`
(compressed) and `FORMAT_SVG_INLINE` (no XML declaration, for embedding in
HTML) are out of scope for the initial port but should be stubbed as separate
quality values so they can be added later without breaking the registry.

### Key SVG rendering behaviors from the C source

- `svg_print_id_class`: emits `id="..."` and `class="..."` attributes.
  `class` is the object type (`"node"`, `"edge"`, `"graph"`, `"cluster"`).
  `id` is the graph object's explicit `id` attribute if set, else the
  auto-generated `"node<N>"` / `"edge<N>"` form.
- URLs: when a node/edge/graph has a `url` attribute, the renderer wraps the
  element in `<a xlink:href="..." xlink:title="...">`. SVG 1.1 requires
  `xlink:href`; SVG 2 prefers plain `href`. Emit both for compatibility.
- Tooltips: emit as `<title>` element inside the group element, before shapes.
- Dashed lines: SVG `stroke-dasharray="5,2"`. Dotted: `"1,5"`.
- Bold pen: `stroke-width` is `PENWIDTH_BOLD` (2.0 pts) instead of
  `PENWIDTH_NORMAL` (1.0 pts).
- `transparent` fill: `fill="transparent"` in SVG. `none` pen: `stroke="none"`.
- Gradients: emit `<defs>` block with `<linearGradient>` or `<radialGradient>`
  before the shape element.
- Ellipses: SVG `<ellipse cx cy rx ry>`. The C renderer receives `A[0]` as
  center, `A[1]` as one corner; `rx = |A[1].x - A[0].x|`,
  `ry = |A[1].y - A[0].y|`.
- Polygons: SVG `<polygon points="x1,y1 x2,y2 ...">` for filled; `<polyline>`
  for unfilled (pen only). Closed by repeating the first point for `<polyline>`.
- Bezier curves: SVG `<path d="M x,y C x1,y1 x2,y2 x,y ...">` using
  `svg_bzptarray` format.
- Text: SVG `<text>` element. Alignment maps to `text-anchor`:
  `'l'` → `"start"`, `'c'` → `"middle"`, `'r'` → `"end"`.

## Task

1. Read `~/git/graphviz/plugin/core/gvrender_core_svg.c` in full before
   writing any code. The file is ~800 lines. Pay particular attention to:
   - `svg_bzptarray` (bezier path construction, Y negation)
   - `svg_begin_graph` (viewBox, width, height computation)
   - `svg_begin_node` / `svg_end_node` (group element structure)
   - `svg_begin_anchor` / `svg_end_anchor` (URL wrapping)
   - `svg_textspan` (text element, font attributes, alignment)
   - `svg_ellipse`, `svg_polygon`, `svg_polyline`, `svg_beziercurve`
   - `svg_resolve_color` (color string normalization)
   Also read `~/git/graphviz/plugin/core/gvplugin_core.c` to see the
   plugin registration table and quality values for the SVG renderer.

2. Implement `SvgRenderer` class in `src/render/svg.ts` implementing
   `RendererPlugin`:

   ```typescript
   export class SvgRenderer implements RendererPlugin {
     readonly type = "svg";
     readonly quality = 0;  // matches C registration quality
     // ... all RendererPlugin methods
   }
   ```

3. The `beginGraph` method emits the XML declaration and opening `<svg>` tag:

   ```
   <?xml version="1.0" encoding="UTF-8" standalone="no"?>
   <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
    "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
   <!-- Generated by graphviz-ts ... -->
   <svg width="<w>pt" height="<h>pt"
        viewBox="<x0> <y0> <w> <h>"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink">
   ```

   Width and height come from `job.bb` in points. `viewBox` origin is
   `(0, 0)` unless there is padding.

4. The `endGraph` method emits `</svg>`.

5. Implement all required `RendererPlugin` methods — no stubs, no
   not-implemented throws. Every method in the interface must be functional.
   Optional methods (`comment`, `beginAnchor`, `endAnchor`, `beginLabel`,
   `endLabel`) should be implemented as they appear in the C source.

6. Export a factory function:

   ```typescript
   export function createSvgRenderer(): RendererPlugin {
     return new SvgRenderer();
   }
   ```

7. Tests in `src/render/svg.test.ts`:
   - Given a minimal graph `digraph G { A -> B }` with layout already applied
     (mock `g.info.bb` and node/edge positions manually), when rendered to SVG,
     then the output is valid SVG XML (use `DOMParser` or a regex check for
     well-formed opening/closing tags).
   - Given a node with position `(72, 72)` (1 inch from lower-left in points),
     when rendered, then the SVG `<ellipse>` or `<polygon>` element has Y
     coordinate equal to `graphHeightPt - 72` (Y-flip applied).
   - Given a node with `label="hello"`, when rendered, then a `<text>` element
     containing `"hello"` appears inside the node's `<g>` group.
   - Given an edge with a spline, when rendered, then a `<path>` element with
     `d="M ..."` attribute appears inside the edge's `<g>` group.

## Write-Set

```
src/render/svg.ts
src/render/svg.test.ts
```

## Read-Set

- `~/git/graphviz/plugin/core/gvrender_core_svg.c` (full — ~800 lines)
- `~/git/graphviz/plugin/core/gvplugin_core.c` — registration table, quality
  values, format IDs
- `src/gvc/context.ts` — `RendererPlugin`, `LabelType`, `PenType`, `FillType`
- `src/gvc/job.ts` — `RenderJob`, `ObjState`, `EmitState`
- `src/gvc/device.ts` — `transformPoint`, flag constants
- `src/model/index.ts` — `Graph`, `Node`, `Edge`

## Architecture Decisions

**AD-2** — Static registration. `SvgRenderer` is directly instantiated; no
`libltdl` or config-file loading. Register via `ctx.register(new SvgRenderer())`
at startup.

**AD-12** — SVG is in scope. `FORMAT_SVGZ` and `FORMAT_SVG_INLINE` are out of
scope; stubs are acceptable if they throw `Error("not implemented: svgz")` etc.

## Interface Contracts

```typescript
// src/render/svg.ts
export class SvgRenderer implements RendererPlugin {
  readonly type: "svg";
  readonly quality: 0;
  beginGraph(g: Graph, job: RenderJob): void;
  endGraph(g: Graph, job: RenderJob): void;
  beginNode(n: Node, job: RenderJob): void;
  endNode(n: Node, job: RenderJob): void;
  beginEdge(e: Edge, job: RenderJob): void;
  endEdge(e: Edge, job: RenderJob): void;
  textspan(pos: Point, span: TextSpan, job: RenderJob): void;
  ellipse(center: Point, rx: number, ry: number, filled: boolean, job: RenderJob): void;
  polygon(pts: Point[], filled: boolean, job: RenderJob): void;
  bezier(pts: Point[], filled: boolean, job: RenderJob): void;
  polyline(pts: Point[], job: RenderJob): void;
  comment(text: string, job: RenderJob): void;
  beginAnchor(href: string, tooltip: string, target: string, id: string, job: RenderJob): void;
  endAnchor(job: RenderJob): void;
  beginLabel(type: LabelType, job: RenderJob): void;
  endLabel(job: RenderJob): void;
}

export function createSvgRenderer(): RendererPlugin;
```

## Acceptance Criteria

- Given a simple graph with layout applied, when rendered to SVG, then the
  output is valid SVG XML (well-formed, contains `<svg>` root with `xmlns`
  attribute, closes with `</svg>`).
- Given a node positioned at point `p` in graph coordinates, when rendered,
  then all Y coordinates in the node's SVG elements satisfy
  `y_svg = graphHeightPt - y_xdot` (Y-flip applied); every Y emit site has
  the required comment in source.
- Given a node with `label="Hello"`, when rendered, then a `<text>` element
  containing `"Hello"` appears inside the node's `<g class="node">` element.
- Given an edge with a bezier spline, when rendered, then a `<path>` element
  with `d` attribute starting with `"M"` appears inside the edge's
  `<g class="edge">` element.

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes, no data migrations.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0; all tests in `svg.test.ts` pass
- One commit: `feat(render): add SVG renderer`
