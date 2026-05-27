# T25 — GVC Context and Engine Registry

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC. Every
algorithm constant and ordering dependency must be reproduced exactly.

T25 ports the root context (`GVC_t` / `GVC_s` in `lib/gvc/gvcint.h`) and the
plugin registry logic (`lib/gvc/gvplugin.c`, `lib/gvc/gvconfig.c`). The C code
uses `libltdl` for dynamic loading; that is replaced here with static
registration (AD-2), but the capability negotiation order — the rule that
determines which renderer wins for a given format string — is preserved exactly
as in `gvplugin_install`.

Key ordering guarantee from `gvplugin_install` (source: `lib/gvc/gvplugin.c`):

1. Plugins are stored sorted **alpha-ascending by type string prefix** (the part
   before any `:`).
2. Within the same type prefix, sorted **quality descending** (higher quality
   first).
3. Equal quality: last-registered wins (new entry inserted ahead of existing
   same-quality entry).

This order is observable: `bestRenderer("svg")` must return the highest-quality
registered SVG renderer, and when quality is tied, the one registered last.

`GvcContext` also owns layout engine dispatch (`gvlayout_select` +
`gvLayoutJobs`) and the single globally-selected `TextMeasurer`
(`gvtextlayout_select` — selected once at construction, shared by all jobs).

## Task

1. Read `~/git/graphviz/lib/gvc/gvc.h`, `~/git/graphviz/lib/gvc/gvcext.h`,
   `~/git/graphviz/lib/gvc/gvcint.h` (GVC_s struct definition), and
   `~/git/graphviz/docs/architecture/lib/gvc.md` (the gvplugin.c section on
   plugin installation and selection ordering) before writing any code.

2. Define the `RendererPlugin` interface in `src/gvc/context.ts`. This is the
   TypeScript equivalent of `gvplugin_installed_t` + `gvrender_engine_s` vtable
   fused into one object (AD-2 eliminates the two-step install/load):

   ```typescript
   export interface RendererPlugin {
     readonly type: string;   // e.g. "svg", "dot", "json"
     readonly quality: number;
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
     comment?(text: string, job: RenderJob): void;
     beginAnchor?(href: string, tooltip: string, target: string, id: string, job: RenderJob): void;
     endAnchor?(job: RenderJob): void;
     beginLabel?(type: LabelType, job: RenderJob): void;
     endLabel?(job: RenderJob): void;
   }
   ```

   `RenderJob` is imported from `src/gvc/job.ts` (written in T26). Forward-declare
   it as `import type { RenderJob } from './job.js'` — circular import is safe
   because all are type-only at the call site.

3. Define the `LayoutEngine` interface:

   ```typescript
   export interface LayoutEngine {
     readonly type: string;  // e.g. "dot", "neato"
     layout(g: Graph): void;
     cleanup(g: Graph): void;
   }
   ```

4. Implement `GvcContext` class:

   ```typescript
   export class GvcContext {
     private readonly renderers: RendererPlugin[] = [];
     private readonly layouts: Map<string, LayoutEngine> = new Map();
     textMeasurer: TextMeasurer;
     readonly debug: DebugOptions | undefined;

     constructor(measurer: TextMeasurer, options?: { debug?: DebugOptions }) {
       this.textMeasurer = measurer;
       this.debug = options?.debug;
     }

     register(plugin: RendererPlugin): void;
     register(engine: LayoutEngine): void;
     bestRenderer(format: string): RendererPlugin;
     layout(g: Graph, engineName: string): void;
     renderToString(g: Graph, format: string): string;
   }
   ```

   The `debug` field is `readonly` and set once at construction. Callers check
   `ctx.debug?.rankAssignment` before emitting; the JIT eliminates the branch
   when `debug` is `undefined`. Never pass `debug` as a separate argument through
   the call stack — always read it from `ctx.debug`.

5. `register(plugin: RendererPlugin)` must maintain the sorted invariant:
   - Find the insertion point: scan `this.renderers` to locate where the new
     type would sort alpha-ascending. Within the same type, higher quality
     entries come first. On equal quality, insert before the first existing
     entry of the same type+quality (last-registered wins = insert at front of
     the tie group).
   - Use `plugin.type.split(':')[0]` as the sort key for alpha comparison (type
     prefix only, matching C behavior).

6. `bestRenderer(format: string)` scans `this.renderers` for the first entry
   whose `type` prefix matches `format`. Throws `Error` with message
   `"no renderer registered for format: <format>"` if none found.

7. `layout(g, engineName)` looks up the engine in `this.layouts`, calls
   `engine.layout(g)`, then calls `engine.cleanup(g)`. Throws
   `Error("no layout engine registered: <engineName>")` if not found.

8. `renderToString(g, format)` creates a `RenderJob`, calls `bestRenderer`,
   drives the render sequence via `renderGraph` from `src/gvc/device.ts`,
   returns the accumulated output string. Import `renderGraph` as a named
   import (not circular because device.ts imports from context.ts, not the
   other way around — the call here is via a passed-in function or via
   late-binding; structure to avoid circular module dependency).

   Implementation note: to avoid a circular import between context.ts and
   device.ts, `renderToString` should accept the graph and format and delegate
   to the device module. One clean approach: export a standalone function
   `render(ctx: GvcContext, g: Graph, format: string): string` from
   `src/gvc/device.ts`, and do NOT put it on `GvcContext`. Document this
   decision in a comment.

9. Export `LabelType` enum matching `label_type` in `gvcjob.h`:
   ```typescript
   export const enum LabelType { Plain = 0, Html = 1 }
   ```

10. Export `PenType`, `FillType` enums matching `pen_type`, `fill_type`:
    ```typescript
    export const enum PenType { None = 0, Dashed, Dotted, Solid }
    export const enum FillType { None = 0, Solid, Linear, Radial }
    ```

## Write-Set

```
src/gvc/context.ts
src/gvc/context.test.ts
```

## Read-Set

- `~/git/graphviz/lib/gvc/gvc.h` — public API signatures
- `~/git/graphviz/lib/gvc/gvcext.h` — `api_t`, `lt_symlist_t`
- `~/git/graphviz/docs/architecture/lib/gvc.md` — plugin installation ordering
  (gvplugin.c section), GVC_s struct fields, behavioral subtleties §1 and §2
- `~/git/graphviz/lib/gvc/gvcjob.h` — `pen_type`, `fill_type`, `label_type`
  enum values
- `src/model/index.ts` — `Graph`, `Node`, `Edge` types
- `src/common/text.ts` — `TextMeasurer`, `TextSpan` (from Batch 5b)
- `src/debug.ts` — `DebugOptions` (defined in T1)

## Architecture Decisions

**AD-2** — Replace `libltdl` dynamic plugin loading with static registration.
Preserve capability negotiation order exactly: renderers sorted alpha-ascending
by type name prefix, then quality descending within a type. This order is
observable and must be reproduced.

## Interface Contracts

```typescript
// Exported from src/gvc/context.ts
export interface RendererPlugin { ... }        // see Task step 2
export interface LayoutEngine { ... }          // see Task step 3
export class GvcContext {                      // see Task step 4
  readonly debug: DebugOptions | undefined;
  constructor(measurer: TextMeasurer, options?: { debug?: DebugOptions });
  ...
}
export const enum LabelType { Plain, Html }
export const enum PenType { None, Dashed, Dotted, Solid }
export const enum FillType { None, Solid, Linear, Radial }
```

`RenderJob` is defined in `src/gvc/job.ts` (T26) — import as type only here.
`DebugOptions` is imported from `src/debug.ts` (T1).

## Acceptance Criteria

- Given two `RendererPlugin` registrations for format `"svg"` with qualities 5
  and 10, when `bestRenderer("svg")` is called, then the plugin with quality 10
  is returned.
- Given two `RendererPlugin` registrations for `"svg"` both with quality 5,
  when the second is registered after the first, then `bestRenderer("svg")`
  returns the second (last-registered wins on tie).
- Given no renderer registered for `"png"`, when `bestRenderer("png")` is
  called, then it throws `Error` with message containing `"png"`.
- Given registrations for `"dot"` (quality 0) and `"svg"` (quality 0), when
  the sorted list is inspected, then `"dot"` entries precede `"svg"` entries
  (alpha-ascending by type).

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes, no data migrations.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0; all tests in `context.test.ts` pass
- One commit: `feat(gvc): add GvcContext with capability negotiation`
