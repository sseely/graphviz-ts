# T31 — plain, IMAP, and CMAPX Renderers

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC.

T31 ports `plugin/core/gvrender_core_map.c`. This renderer handles six formats
via a single format enum in the C file:

```c
enum { FORMAT_IMAP, FORMAT_ISMAP, FORMAT_CMAP, FORMAT_CMAPX };
```

But the plugin registration table registers six type strings:
`"imap"`, `"imap-np"` (no-prelude), `"cmapx"`, `"cmapx-np"`, `"plain"`,
`"plain-ext"`.

TypeScript scope (AD-12): implement all six, matching the C registration table.

### Format descriptions

| Format | Description |
|--------|-------------|
| `imap` | Server-side image map (Apache-style `rect/circle/poly` format) |
| `imap-np` | `imap` without the default URL prelude line |
| `cmapx` | Client-side HTML image map (`<map>` with `<area>` elements) |
| `cmapx-np` | `cmapx` without the outer `<map>` wrapper |
| `plain` | Plain-text position list: one node per line, one edge per line |
| `plain-ext` | `plain` with additional edge port information |

### plain format

The plain format writes one line per node and one line per edge:

```
graph <scale> <width> <height>
node <name> <x> <y> <width> <height> <label> <style> <shape> <color> <fillcolor>
edge <tail> <head> <n> <x1> <y1>...<xn> <yn> [<label> <xl> <yl>]
stop
```

Coordinates are in **inches** (divide points by 72). `<scale>` is the zoom
factor (default 1.0). Floating-point values use `printNum` format (3 decimals,
leading `0.` collapsed to `.`).

The `plain-ext` variant adds port names to the edge line:

```
edge <tail> <tailport> <head> <headport> <n> <x1> <y1>...
```

### IMAP format

Server-side image map. Only objects with a non-empty `url` attribute produce
output. Format:

```
base referer
default <url>
rect <url> <x0,y0> <x1,y1>    (for rectangular regions)
circle <url> <cx,cy,r>         (for circular regions)
poly <url> <x1,y1> <x2,y2>... (for polygon regions)
```

Coordinates are integers (rounded with `%.0f`). Y axis is already
top-to-bottom (coordinates come pre-transformed from `transformPoint`).
`imap-np` omits the `base referer\ndefault <url>` header.

### CMAPX format

Client-side HTML image map. Only objects with a non-empty `url` attribute
produce output. Format:

```html
<map id="<graphname>" name="<graphname>">
<area shape="rect" href="<url>" title="<tooltip>" target="<target>"
      coords="<x0>,<y0>,<x1>,<y1>" id="<id>" />
<area shape="circle" href="<url>" title="<tooltip>"
      coords="<cx>,<cy>,<r>" />
<area shape="poly" href="<url>" title="<tooltip>"
      coords="<x1>,<y1>,<x2>,<y2>,..." />
</map>
```

URLs must be XML-escaped (use `gvputs_xml` equivalent — XML-escape `&`, `<`,
`>`, `"`, `'`). `cmapx-np` omits the outer `<map>...</map>` wrapper.

### Coordinate system

All map renderer coordinates come from `job.obj.urlMapPts` and
`job.obj.urlBsplineMapPts`, which are already in device units (pre-transformed
by `gvrender_ptf` / `transformPoint`). The device units for map formats use
`GVRENDER_Y_GOES_DOWN` — coordinates are screen-space (Y increases downward)
and must not be flipped again inside the renderer.

### Note: FORMAT_ISMAP vs FORMAT_CMAP

In the C code, the enum has `FORMAT_ISMAP` and `FORMAT_CMAP` but the
registered type strings are `"imap"` and `"cmapx"`. The `-np` suffix variants
use the same format IDs but a flag on the plugin registration distinguishes
them. In TypeScript, use separate classes or a constructor parameter:

```typescript
class ImapRenderer implements RendererPlugin {
  constructor(private readonly includePrelude: boolean) {}
  readonly type: string;  // "imap" or "imap-np"
}
```

## Task

1. Read `~/git/graphviz/plugin/core/gvrender_core_map.c` in full before
   writing any code. Pay particular attention to:
   - `map_output_shape` — the core shape-output function, called from node
     and edge callbacks.
   - `map_begin_page` / `map_end_page` — IMAP prelude output.
   - `map_begin_node` / `map_end_node` — node area output.
   - `map_begin_edge` / `map_end_edge` — edge bspline polygon output.
   - `map_begin_cluster` / `map_end_cluster` — cluster area output.
   - The plain-format output functions (`plain_begin_graph`, `plain_end_graph`,
     `plain_begin_node`, `plain_begin_edge`).
   - `xml_url_puts` — URL-escaped output for `href` attributes.

2. Implement six renderer classes (or fewer with constructor flags):
   - `ImapRenderer` (type `"imap"`, includes prelude)
   - `ImapNpRenderer` (type `"imap-np"`, no prelude)
   - `CmapxRenderer` (type `"cmapx"`, includes `<map>` wrapper)
   - `CmapxNpRenderer` (type `"cmapx-np"`, no wrapper)
   - `PlainRenderer` (type `"plain"`)
   - `PlainExtRenderer` (type `"plain-ext"`, includes port names)

   All implement `RendererPlugin`. Quality for all is 0 (matching the C
   registration table). Renderers that do not use `beginGraph`/`endGraph` for
   markup (plain, imap) may implement them as no-ops or minimal output.

3. Plain renderer's `beginGraph` writes the `graph` header line. `endGraph`
   writes `stop`. Node info is written from the node's `info` field
   (position, dimensions, label, style, shape, color, fillcolor).

4. Plain renderer coordinates must match C binary output to `±0.01` (within
   floating-point rounding of the `printNum` function). This is the tightest
   matching requirement of the four Batch 7 renderers.

5. CMAPX renderer must XML-escape all href, title, and target attribute values
   before emitting them. Implement `xmlEscape(s: string): string` as a local
   helper that handles `&`, `<`, `>`, `"`, and `'`.

6. Export factory functions for each format:

   ```typescript
   export function createImapRenderer(): RendererPlugin;
   export function createImapNpRenderer(): RendererPlugin;
   export function createCmapxRenderer(): RendererPlugin;
   export function createCmapxNpRenderer(): RendererPlugin;
   export function createPlainRenderer(): RendererPlugin;
   export function createPlainExtRenderer(): RendererPlugin;
   ```

7. Tests in `src/render/map.test.ts`:
   - Given a simple graph rendered to `"plain"` format, then the first line
     starts with `"graph "` and contains three numeric values (scale, width,
     height), and one line per node starts with `"node "`.
   - Given a graph with a node that has a `url` attribute, when rendered to
     `"cmapx"`, then the output contains an `<area>` element with an `href`
     attribute matching the URL.
   - Given a graph with a node without a `url` attribute, when rendered to
     `"cmapx"`, then no `<area>` element appears for that node.
   - Given a graph rendered to `"cmapx"`, then the output is wrapped in
     `<map ...>...</map>` (including newlines); rendered to `"cmapx-np"`,
     then no `<map>` wrapper is present.

## Write-Set

```
src/render/map.ts
src/render/map.test.ts
```

## Read-Set

- `~/git/graphviz/plugin/core/gvrender_core_map.c` (full)
- `src/gvc/context.ts` — `RendererPlugin`
- `src/gvc/job.ts` — `RenderJob`, `ObjState`, `MapShape`, `ObjType`
- `src/gvc/device.ts` — `GVRENDER_Y_GOES_DOWN`, `GVRENDER_DOES_MAPS`
- `src/render/dot.ts` — `printNum` (shared helper)
- `src/model/index.ts` — `Graph`, `Node`, `Edge`

## Architecture Decisions

**AD-2** — Static registration. Register all six renderers via
`ctx.register(createImapRenderer())` etc. at startup.

**AD-12** — All six map/plain formats are in scope.

## Interface Contracts

```typescript
// src/render/map.ts
export function createImapRenderer(): RendererPlugin;
export function createImapNpRenderer(): RendererPlugin;
export function createCmapxRenderer(): RendererPlugin;
export function createCmapxNpRenderer(): RendererPlugin;
export function createPlainRenderer(): RendererPlugin;
export function createPlainExtRenderer(): RendererPlugin;

// Internal helper — exported for testing
export function xmlEscape(s: string): string;
```

All returned objects implement `RendererPlugin` from `src/gvc/context.ts`.

## Acceptance Criteria

- Given a laid-out graph rendered to `"plain"` format, then the output has
  one `node` line per node and positions match C binary output within `±0.01`
  (in inches, which equals `±0.7` in points before dividing by 72).
- Given a node with `url="https://example.com"`, when rendered to `"cmapx"`,
  then the output contains `<area` with `href="https://example.com"`.
- Given a graph rendered to `"cmapx"`, then the output begins with `<map`
  and ends with `</map>`.
- Given a graph rendered to `"cmapx-np"`, then the output does NOT contain
  `<map` or `</map>`.

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes, no data migrations.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0; all tests in `map.test.ts` pass
- One commit: `feat(render): add plain, IMAP, and CMAPX renderers`
