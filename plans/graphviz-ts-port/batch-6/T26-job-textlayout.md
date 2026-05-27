# T26 — Text Layout Selection and Job Lifecycle

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC.

T26 ports two closely related concerns that are implemented in separate C files
but share the `GVJ_t` type:

1. **`lib/gvc/gvjobs.c` + `GVJ_t` from `lib/gvc/gvcjob.h`** — the per-render-job
   state object. In the C code, `GVJ_t` is a large struct allocated once per
   `gvRender*` call and freed by `gvjobs_delete`. In TypeScript, it becomes the
   `RenderJob` class, scoped to a single render invocation.

2. **`lib/gvc/gvtextlayout.c`** — text-layout engine selection and dispatch.
   The C code calls `gvtextlayout_select` once at context creation, storing the
   selected engine in `gvc->textlayout`. All jobs and graphs within a session
   share this single selection. In TypeScript, the selection lives on
   `GvcContext.textMeasurer` (set in the constructor via AD-10) and is injected
   into each `RenderJob` at construction time.

### Key invariants from the C source

- `GVJ_t::output_data` starts at 4096 bytes and grows via `realloc`. TypeScript
  replaces this with a string array (`output: string[]`) that is joined at the
  end. This avoids manual buffer management with no behavioral difference.
- `GVJ_t::obj` is a stack of `obj_state_t` records linked via `parent`. Nested
  clusters push/pop this stack. TypeScript must implement the same stack
  discipline using an array; failing to do so corrupts color/style state for
  nested clusters (gvc.md behavioral subtlety §3).
- Text layout selection (AD-10): Browser environments inject a Canvas 2D
  `TextMeasurer`; Node/test environments use the LUT measurer. The selection
  is made by the caller of `GvcContext` and passed in; `RenderJob` inherits
  the measurer from the context.

## Task

1. Read `~/git/graphviz/lib/gvc/gvcjob.h` fully — the `GVJ_s` struct, all flag
   bit definitions, `obj_state_t`, `pen_type`, `fill_type`, `emit_state_t`.
   Read `~/git/graphviz/lib/gvc/gvtextlayout.c` and the first 100 lines of
   `~/git/graphviz/lib/gvc/gvrender.c` before writing any code.

2. Implement `ObjState` in `src/gvc/job.ts` — the TypeScript equivalent of
   `obj_state_t`. All pointer fields become `null`-initialized strings or typed
   references. Bit-field booleans become `boolean`. Z-depth fields (`z`,
   `tail_z`, `head_z`) are retained but documented as VRML-only:

   ```typescript
   export interface ObjState {
     parent: ObjState | null;
     type: ObjType;
     // graph object reference — exactly one is set based on type
     graphObj: Graph | Node | Edge | null;
     emitState: EmitState;
     penColor: GvColor;
     fillColor: GvColor;
     stopColor: GvColor;
     gradientAngle: number;
     gradientFrac: number;
     pen: PenType;
     fill: FillType;
     penWidth: number;
     rawStyle: string[];
     // labels
     label: string | null;
     xlabel: string | null;
     tailLabel: string | null;
     headLabel: string | null;
     // hyperlink
     url: string | null;
     id: string | null;
     labelUrl: string | null;
     tailUrl: string | null;
     headUrl: string | null;
     // tooltips
     tooltip: string | null;
     labelTooltip: string | null;
     tailTooltip: string | null;
     headTooltip: string | null;
     // link targets
     target: string | null;
     labelTarget: string | null;
     tailTarget: string | null;
     headTarget: string | null;
     // explicit-set bits
     explicitTooltip: boolean;
     explicitTailTooltip: boolean;
     explicitHeadTooltip: boolean;
     explicitLabelTooltip: boolean;
     explicitTailTarget: boolean;
     explicitHeadTarget: boolean;
     explicitEdgeTarget: boolean;
     explicitTailUrl: boolean;
     explicitHeadUrl: boolean;
     labelEdgeAligned: boolean;
     // map regions
     urlMapShape: MapShape;
     urlMapPts: Point[];
     urlBsplineMapPts: Point[][];   // array of polygons
     tailEndMapPts: Point[];
     headEndMapPts: Point[];
   }
   ```

3. Export `ObjType`, `EmitState`, `MapShape` enums matching `obj_type`,
   `emit_state_t`, `map_shape_t` in `gvcjob.h`:

   ```typescript
   export const enum ObjType {
     RootGraph = 0, Cluster, Node, Edge
   }
   export const enum EmitState {
     GDraw = 0, CDraw, TDraw, HDraw,
     GLabel, CLabel, TLabel, HLabel,
     NDraw, EDraw, NLabel, ELabel,
   }
   export const enum MapShape { Rectangle = 0, Circle, Polygon }
   ```

   The `EmitState` enum order must match the C definition exactly — the DOT
   renderer's `xbufs` array in `gvrender_core_dot.c` uses these as indices.

4. Implement `RenderJob` class:

   ```typescript
   export class RenderJob {
     // output accumulation (replaces GVJ_t::output_data growable buffer)
     readonly output: string[] = [];

     // injected at construction from GvcContext.textMeasurer
     readonly measurer: TextMeasurer;

     // renderer format name
     readonly format: string;

     // coordinate system state (from GVJ_t)
     bb: Box;          // graph bounding box with padding (graph units)
     pad: Point;
     zoom: number;     // default 1.0
     dpi: Point;       // default { x: 96, y: 96 }
     rotation: number; // degrees; 0=portrait
     scale: Point;     // composite graph-to-device scale
     translation: Point;
     devscale: Point;  // sign-inverts y when GVRENDER_Y_GOES_DOWN

     // render flags (bitfield — use the flag constants from gvcjob.h)
     flags: number;

     // obj stack (GVJ_t::obj is a pointer into a stack; implement as array)
     private readonly objStack: ObjState[] = [];
     get obj(): ObjState | null { ... }  // top of stack, or null
     pushObj(state: ObjState): void;     // push
     popObj(): void;                     // pop; throws if stack empty

     // page/layer state
     numLayers: number;
     layerNum: number;

     constructor(format: string, measurer: TextMeasurer) { ... }

     // output helpers (mirrors gvputs, gvprintf, gvprintdouble)
     write(s: string): void;
     printDouble(n: number): void;  // compact: no trailing zeros, no -0
     printPoint(p: Point): void;    // "x y" using printDouble
   }
   ```

5. `printDouble(n)` must replicate `gvprintdouble` from `gvdevice.c`:
   - Values in `(-0.005, 0.005)` emit as `"0"` (suppresses `-0`).
   - Otherwise: format to 2 decimal places, strip trailing zeros and trailing
     decimal point if no fractional part remains.
   - Example: `0.5` → `"0.5"`, `1.0` → `"1"`, `-0.003` → `"0"`.

6. Implement `selectTextLayout` in `src/gvc/textlayout.ts`:

   ```typescript
   export function selectTextLayout(ctx: GvcContext): TextMeasurer {
     // Mirrors gvtextlayout_select: picks the best available TextMeasurer.
     // In the TypeScript port (AD-10), the measurer is injected into
     // GvcContext at construction. This function returns ctx.textMeasurer.
     // It exists as a named export to match the C function's role and to
     // allow future substitution without changing GvcContext.
     return ctx.textMeasurer;
   }
   ```

   Also export `measure(span: TextSpan, ctx: GvcContext): void` — wraps
   `ctx.textMeasurer.measure` and updates `span.size` in place, mirroring
   `gvtextlayout(gvc, span, fontpath)`.

7. Tests in `src/gvc/job.test.ts`:
   - Verify `printDouble` output for representative values: 0, -0, 0.5, 1.0,
     1.23456, 0.003, -0.003, 100.
   - Verify `pushObj`/`popObj` stack discipline: push two states, verify `obj`
     returns the top, pop once, verify `obj` returns the previous, pop again,
     verify `obj` is null.
   - Verify that `output` accumulates correctly across multiple `write` calls.

## Write-Set

```
src/gvc/job.ts
src/gvc/textlayout.ts
src/gvc/job.test.ts
```

## Read-Set

- `~/git/graphviz/lib/gvc/gvcjob.h` — `GVJ_s`, `obj_state_t`, all enums,
  flag bit constants
- `~/git/graphviz/lib/gvc/gvtextlayout.c` — `gvtextlayout_select`,
  `gvtextlayout`
- `~/git/graphviz/lib/gvc/gvrender.c` (first 100 lines) — `gvrender_select`,
  coordinate transform setup
- `~/git/graphviz/lib/gvc/gvdevice.c` (first 100 lines) — `gvprintdouble`,
  `gvwrite_no_z` output dispatch
- `src/gvc/context.ts` — `GvcContext`, `PenType`, `FillType`, `LabelType`
- `src/common/text.ts` — `TextMeasurer`, `TextSpan`, `GvColor`

## Architecture Decisions

**AD-10** — `TextMeasurer` interface abstracts Canvas (browser) and LUT
(Node/test). The measurer is injected into `GvcContext` at construction and
flows to `RenderJob` from there. There is no runtime detection or fallback
inside the port itself — the selection is the caller's responsibility.

## Interface Contracts

```typescript
// src/gvc/job.ts
export class RenderJob {
  readonly output: string[];
  readonly measurer: TextMeasurer;
  readonly format: string;
  bb: Box;
  pad: Point;
  zoom: number;       // 1.0 default
  dpi: Point;         // { x: 96, y: 96 } default
  rotation: number;   // 0 default
  scale: Point;
  translation: Point;
  devscale: Point;
  flags: number;
  numLayers: number;
  layerNum: number;
  get obj(): ObjState | null;
  pushObj(state: ObjState): void;
  popObj(): void;
  write(s: string): void;
  printDouble(n: number): void;
  printPoint(p: Point): void;
}

// src/gvc/textlayout.ts
export function selectTextLayout(ctx: GvcContext): TextMeasurer;
export function measure(span: TextSpan, ctx: GvcContext): void;
```

## Acceptance Criteria

- Given a `RenderJob`, when `write("foo")` and `write("bar")` are called, then
  `job.output.join("")` equals `"foobar"`.
- Given `printDouble` called with values `[0, -0.001, 0.5, 1.0, 1.5]`, then
  output is `["0", "0", "0.5", "1", "1.5"]` respectively.
- Given an `ObjState` pushed then a second pushed, when `popObj` is called once,
  then `obj` returns the first state; when `popObj` is called again, `obj` is
  null.

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes, no data migrations.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0; all tests in `job.test.ts` pass
- One commit: `feat(gvc): add RenderJob and text layout selection`
