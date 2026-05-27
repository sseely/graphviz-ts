# T29 — DOT and XDOT Renderer

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC.

T29 ports `plugin/core/gvrender_core_dot.c`. This renderer handles six format
IDs defined in an enum at the top of the file:

```c
typedef enum {
  FORMAT_DOT,
  FORMAT_CANON,
  FORMAT_PLAIN,
  FORMAT_PLAIN_EXT,
  FORMAT_XDOT,
  FORMAT_XDOT12,
  FORMAT_XDOT14,
} format_type;
```

TypeScript scope (AD-12): implement `FORMAT_DOT` and `FORMAT_XDOT`. The CANON,
PLAIN, PLAIN_EXT, XDOT12, XDOT14 formats are either out of scope or handled
elsewhere. `FORMAT_PLAIN` and `FORMAT_PLAIN_EXT` are handled by T31 (map
renderer, which also covers the plain formats in C).

### DOT output

DOT output writes the graph back in DOT syntax with position attributes
embedded. The renderer walks the graph in the emit order determined by
`job.flags` and writes attribute lines for each object. Coordinate values
use `printDouble` format (same as gvprintdouble: compact, no trailing zeros).

### XDOT output

XDOT format is DOT with layout positions **and** xdot drawing operations
embedded as `_draw_` and `_ldraw_` attributes on each node and edge. The
xdot ops describe the actual rendered shapes in a compact string format
understood by xdot-aware viewers.

The C implementation accumulates xdot drawing operations into per-emit-state
buffers (`xbuf[NUMXBUFS]`) indexed by `emit_state_t` values. The mapping of
`emit_state_t` to `xbuf` slots is defined by the `xbufs` array (lines 53–58):

```c
static agxbuf* xbufs[] = {
  xbuf+EMIT_GDRAW, xbuf+EMIT_CDRAW, xbuf+EMIT_TDRAW, xbuf+EMIT_HDRAW,
  xbuf+EMIT_GLABEL, xbuf+EMIT_CLABEL, xbuf+EMIT_TLABEL, xbuf+EMIT_HLABEL,
  xbuf+EMIT_CDRAW, xbuf+EMIT_CDRAW, xbuf+EMIT_CLABEL, xbuf+EMIT_CLABEL,
};
```

Note: `EMIT_NDRAW` (8) and `EMIT_EDRAW` (9) both map to `xbuf+EMIT_CDRAW`
(index 1). `EMIT_NLABEL` (10) and `EMIT_ELABEL` (11) both map to
`xbuf+EMIT_CLABEL` (index 5). This aliasing is intentional — nodes and
edges share the cluster draw/label buffers in the xdot renderer. The
TypeScript port must replicate this aliasing exactly; the `EmitState` enum
values in `src/gvc/job.ts` serve as the index.

XDOT version string: `"1.7"` (from `#define XDOTVERSION "1.7"` in the C file).
Emit as graph attribute `xdotversion="1.7"`.

### Coordinate system

DOT and XDOT use **points** for positions. The `pos` attribute format is
`"x,y"` where both values are in points (1/72 inch) with two decimal places.
Positions originate at lower-left (PostScript convention) — no Y-flip for DOT
output. The C source writes `pos` using `gvprintpointf` which calls
`gvprintnum` (3-decimal-place compact format, not `gvprintdouble`).

Implement `printNum(n: number): string` in `src/render/dot.ts` matching
`gvprintnum` behavior:
- 3 decimal places max, trailing zeros stripped.
- Leading `0.` collapses to `.` (e.g. `0.5` → `.5`).
- Range capped at ±999999999999999.99 (match C constant).
- `-0` suppressed: values in `(-0.005, 0.005)` emit as `"0"`.

## Task

1. Read `~/git/graphviz/plugin/core/gvrender_core_dot.c` in full before
   writing any code. Pay particular attention to:
   - The `xbufs` and `penwidth` array initializations (lines 53–60).
   - `dot_begin_graph` / `dot_end_graph` — graph attribute output.
   - `dot_begin_node` / `dot_end_node` — node attribute output, `pos` format.
   - `dot_begin_edge` / `dot_end_edge` — edge attribute output, spline format.
   - `dot_textspan` — how text ops are accumulated in xbuf.
   - `dot_ellipse`, `dot_polygon`, `dot_bezier`, `dot_polyline` — xdot op
     format strings.
   - `dot_end_node` and `dot_end_edge` — how xbuf content is flushed to
     `_draw_` and `_ldraw_` attributes.

2. Implement `DotRenderer` class implementing `RendererPlugin` with
   `type = "dot"` and `quality = 0`.

3. Implement `XdotRenderer` class implementing `RendererPlugin` with
   `type = "xdot"` and `quality = 0`.

   Both classes may share a common base class or helper functions for the
   xbuf accumulation logic. The key behavioral difference:
   - `DotRenderer.beginGraph` does NOT emit `xdotversion` attribute.
   - `XdotRenderer.beginGraph` emits `graph [xdotversion="1.7" ...]`.
   - `DotRenderer` node/edge callbacks write position and size attributes only.
   - `XdotRenderer` node/edge callbacks additionally flush xbuf content into
     `_draw_` and `_ldraw_` attributes.

4. DOT output format for nodes:

   ```
   <name> [pos="x,y" width=w height=h label="..." ...];
   ```

   Positions use `printNum` (3 decimals, leading zero collapsed). Width and
   height use `printNum` (in inches: divide points by 72).

5. DOT output format for edges:

   ```
   <tail> -> <head> [pos="e,x,y x1,y1 x2,y2 x3,y3 ..." label="..." ...];
   ```

   The `pos` value for edges is the spline in `"e,ex,ey x1,y1 ..."` format
   where `ex,ey` is the endpoint (arrowhead) and the remaining are cubic bezier
   control points. For undirected graphs, use `--` instead of `->`.

6. Export factory functions:

   ```typescript
   export function createDotRenderer(): RendererPlugin;
   export function createXdotRenderer(): RendererPlugin;
   ```

7. Tests in `src/render/dot.test.ts`:
   - `printNum`: verify `0.5` → `".5"`, `1.0` → `"1"`, `1.5` → `"1.5"`,
     `0.001` → `"0"`, `-0.001` → `"0"`, `72.0` → `"72"`.
   - Given a laid-out graph with nodes, when DOT-rendered, then the output
     contains `pos="x,y"` attributes and round-trips through the DOT parser
     producing a graph with the same node names.
   - Given a laid-out graph with one edge, when XDOT-rendered, then the output
     contains `_draw_` attribute on at least one graph object.
   - Given an XDOT-rendered graph, then the output contains
     `xdotversion="1.7"` in the graph attributes.

## Write-Set

```
src/render/dot.ts
src/render/dot.test.ts
```

## Read-Set

- `~/git/graphviz/plugin/core/gvrender_core_dot.c` (full)
- `src/gvc/context.ts` — `RendererPlugin`, `LabelType`
- `src/gvc/job.ts` — `RenderJob`, `ObjState`, `EmitState`
- `src/gvc/device.ts` — flag constants
- `src/model/index.ts` — `Graph`, `Node`, `Edge`

## Architecture Decisions

**AD-2** — Static registration; no dynamic loading. Register via
`ctx.register(new DotRenderer())` and `ctx.register(new XdotRenderer())`.

**AD-12** — DOT and XDOT are in scope. FORMAT_CANON, FORMAT_XDOT12,
FORMAT_XDOT14 are out of scope; throw `Error("not implemented: <format>")`.

## Interface Contracts

```typescript
// src/render/dot.ts
export class DotRenderer implements RendererPlugin {
  readonly type: "dot";
  readonly quality: 0;
}

export class XdotRenderer implements RendererPlugin {
  readonly type: "xdot";
  readonly quality: 0;
}

export function createDotRenderer(): RendererPlugin;
export function createXdotRenderer(): RendererPlugin;

// Internal helper — also exported for testing
export function printNum(n: number): string;
```

## Acceptance Criteria

- Given a laid-out graph, when DOT-rendered, then the output contains
  `pos="x,y"` attributes and re-parses as a valid DOT graph with identical
  node names and edge topology.
- Given an XDOT-rendered laid-out graph, then the output contains `_draw_`
  and `_ldraw_` attributes on at least one node or edge.
- Given an XDOT-rendered graph, then `xdotversion="1.7"` appears in graph
  attributes.
- Given `printNum(0.5)`, then the result is `".5"` (leading zero collapsed).

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes, no data migrations.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0; all tests in `dot.test.ts` pass
- One commit: `feat(render): add DOT and XDOT renderers`
