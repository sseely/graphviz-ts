# T27 — SVG Device Infrastructure

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC.

T27 ports the device-level render loop from `lib/gvc/gvdevice.c` and
`lib/gvc/gvrender.c`. In the C code, `gvdevice.c` owns I/O dispatch (file /
memory buffer / external write_fn), number formatting, and the
`gvdevice_initialize` / `gvdevice_format` / `gvdevice_finalize` lifecycle. The
render loop that drives renderer callbacks for a complete graph is orchestrated
by `emit.c` in `lib/common/`, which calls into `gvrender.c`. In the TypeScript
port, T27 implements the function `renderGraph` that combines both concerns into
a single driving loop.

The coordinate transformation in `gvrender_ptf` (source: `gvrender.c`) is also
implemented here. It converts graph-unit points to device-unit points before
passing them to renderer callbacks. The SVG renderer does NOT set
`GVRENDER_DOES_TRANSFORM`, so pre-transformation applies.

### Coordinate transformation formula (from `gvrender.c`)

```
scale.x = job.zoom * job.devscale.x
scale.y = job.zoom * job.devscale.y

if rotation != 0:
  out.x = -(p.y + job.translation.y) * scale.x
  out.y =  (p.x + job.translation.x) * scale.y
else:
  out.x = (p.x + job.translation.x) * scale.x
  out.y = (p.y + job.translation.y) * scale.y
```

When `GVRENDER_DOES_TRANSFORM` flag is set on the job, raw graph coordinates
are passed directly — `transformPoint` is NOT called. SVG does not set this
flag.

### Render sequence (from gvc.md "Plugin Capability Negotiation — Complete Flow")

```
renderGraph(g, job, renderer):
  renderer.beginGraph(g, job)
  renderer.beginPage?(...)
    for each layer:
      renderer.beginLayer?(...)
        renderer.beginNodes?(...)
        for each node:
          renderer.beginNode(n, job)
          [draw primitives for n via emit.c]
          renderer.endNode(n, job)
        renderer.endNodes?(...)
        renderer.beginEdges?(...)
        for each edge:
          renderer.beginEdge(e, job)
          [draw primitives for e via emit.c]
          renderer.endEdge(e, job)
        renderer.endEdges?(...)
      renderer.endLayer?(...)
  renderer.endPage?(...)
  renderer.endGraph(g, job)
```

In Graphviz's C code, the node/edge/cluster walk is in `lib/common/emit.c`
(`emit_graph`). T27 does not re-implement `emit.c` in full — that is done in
Batch 5c (T24). T27's `renderGraph` calls the emit machinery from T24 with the
renderer callbacks as parameters.

If `emit.c` is not yet available (T27 may be written before Batch 5c is
complete for structural reasons), stub the node and edge walks as direct
iterations over `g.nodes` and `g.edges` in BFS order and document the stub.

## Task

1. Read `~/git/graphviz/lib/gvc/gvdevice.c` and
   `~/git/graphviz/lib/gvc/gvrender.c` (full) before writing any code.

2. Implement `transformPoint` in `src/gvc/device.ts`:

   ```typescript
   export function transformPoint(p: Point, job: RenderJob): Point
   ```

   Implements `gvrender_ptf`. When `job.flags & GVRENDER_DOES_TRANSFORM` is set,
   returns `p` unchanged. Otherwise applies the formula above using
   `job.zoom`, `job.devscale`, `job.translation`, and `job.rotation`.

3. Implement `renderGraph`:

   ```typescript
   export function renderGraph(
     g: Graph,
     job: RenderJob,
     renderer: RendererPlugin
   ): string
   ```

   This is the primary public export of `src/gvc/device.ts`.

   Sequence:
   a. Call `renderer.beginGraph(g, job)`.
   b. Walk graph objects in the order required by `job.flags`:
      - If `EMIT_SORTED` (bit 0): nodes before edges.
      - Default: breadth-first walk order (same as `emit_graph` in C).
      - If `EMIT_CLUSTERS_LAST` (bit 2): clusters after nodes and edges.
   c. For each node `n`: call `renderer.beginNode(n, job)`, emit draw
      primitives from node's xdot ops (see T24), call `renderer.endNode(n, job)`.
   d. For each edge `e`: call `renderer.beginEdge(e, job)`, emit draw
      primitives, call `renderer.endEdge(e, job)`.
   e. Call `renderer.endGraph(g, job)`.
   f. Return `job.output.join("")`.

4. Implement `render` — the top-level convenience function used by
   `GvcContext.renderToString`:

   ```typescript
   export function render(
     ctx: GvcContext,
     g: Graph,
     format: string
   ): string
   ```

   Creates a `RenderJob(format, ctx.textMeasurer)`, initializes `job.bb` from
   `g.info.bb`, computes `job.devscale` (y-sign-inverted for SVG because
   `GVRENDER_Y_GOES_DOWN` is set), selects renderer via `ctx.bestRenderer(format)`,
   calls `renderGraph(g, job, renderer)`, returns the result.

5. Export flag constants matching the C `#define` values in `gvcjob.h`:

   ```typescript
   export const EMIT_SORTED              = 1 << 0;
   export const EMIT_COLORS              = 1 << 1;
   export const EMIT_CLUSTERS_LAST       = 1 << 2;
   export const GVRENDER_Y_GOES_DOWN     = 1 << 12;
   export const GVRENDER_DOES_TRANSFORM  = 1 << 13;
   export const GVRENDER_DOES_LABELS     = 1 << 15;
   export const GVRENDER_DOES_MAPS       = 1 << 16;
   export const GVRENDER_DOES_TOOLTIPS   = 1 << 22;
   export const GVRENDER_DOES_TARGETS    = 1 << 23;
   export const LAYOUT_NOT_REQUIRED      = 1 << 26;
   export const OUTPUT_NOT_REQUIRED      = 1 << 27;
   ```

   The numeric values must match `gvcjob.h` exactly — they are used as flags
   in `RenderJob.flags` and checked by renderer implementations.

6. Tests in `src/gvc/device.test.ts`:
   - `transformPoint`: given a point `{x:1, y:2}` with zoom=1, devscale
     `{x:1, y:-1}`, translation `{x:0, y:0}`, rotation=0, expect
     `{x:1, y:-2}`.
   - `transformPoint` with `GVRENDER_DOES_TRANSFORM` flag set: expect point
     returned unchanged.
   - `renderGraph`: given a minimal stub graph with one node and one edge,
     and a mock renderer that appends call names to an array, verify that
     `beginGraph` is called before any `beginNode`, and `endGraph` is called
     after all `endEdge` calls.
   - `renderGraph`: given a graph with no nodes and no edges, verify that
     `beginGraph` and `endGraph` are both called exactly once.

## Write-Set

```
src/gvc/device.ts
src/gvc/device.test.ts
```

## Read-Set

- `~/git/graphviz/lib/gvc/gvdevice.c` — I/O dispatch, `gvprintdouble`,
  `gvprintnum`, `gvdevice_initialize`, `gvdevice_format`, `gvdevice_finalize`
- `~/git/graphviz/lib/gvc/gvrender.c` — `gvrender_ptf`, `gvrender_select`,
  `gvrender_begin_graph`, `gvrender_end_graph`, render callback dispatch pattern
- `src/gvc/context.ts` — `GvcContext`, `RendererPlugin`
- `src/gvc/job.ts` — `RenderJob`, flag constants location
- `src/model/index.ts` — `Graph`, `Node`, `Edge`

## Architecture Decisions

**AD-2** — Static registration replaces `libltdl`. The device/render plugin
coupling (`API_device` depends on `API_render` in C) is collapsed: each
`RendererPlugin` is self-contained; there is no separate "device" layer.

## Interface Contracts

```typescript
// src/gvc/device.ts

export const EMIT_SORTED: number;
export const EMIT_COLORS: number;
export const EMIT_CLUSTERS_LAST: number;
export const GVRENDER_Y_GOES_DOWN: number;
export const GVRENDER_DOES_TRANSFORM: number;
export const GVRENDER_DOES_LABELS: number;
export const GVRENDER_DOES_MAPS: number;
export const GVRENDER_DOES_TOOLTIPS: number;
export const GVRENDER_DOES_TARGETS: number;
export const LAYOUT_NOT_REQUIRED: number;
export const OUTPUT_NOT_REQUIRED: number;

export function transformPoint(p: Point, job: RenderJob): Point;

export function renderGraph(
  g: Graph,
  job: RenderJob,
  renderer: RendererPlugin
): string;

export function render(
  ctx: GvcContext,
  g: Graph,
  format: string
): string;
```

## Acceptance Criteria

- Given `renderGraph` called with a graph and a mock renderer, then
  `renderer.beginGraph` is called before any node/edge callback, and
  `renderer.endGraph` is called after all node/edge callbacks.
- Given `renderGraph` called with a graph, then the return value equals
  `job.output.join("")` — i.e., all strings written via `job.write` are
  present in the output.
- Given `transformPoint` with `GVRENDER_Y_GOES_DOWN` set and devscale
  `{x:1, y:-1}`, then Y coordinates are sign-inverted relative to input.
- Given `transformPoint` with `GVRENDER_DOES_TRANSFORM` set, then the
  input point is returned unchanged regardless of devscale and zoom.

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes, no data migrations.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0; all tests in `device.test.ts` pass
- One commit: `feat(gvc): add device render loop and coordinate transform`
