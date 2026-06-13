# T15 — lib/xdot Port

## Context

The project is a faithful TypeScript 5.x port of Graphviz `lib/`, targeting
SVG output. TypeScript strict mode, Vitest, esbuild, EPL-2.0, no Node.js in
core.

`lib/xdot` parses and serializes xdot attribute strings — the extended DOT
format in which layout engines embed final drawing instructions for every
graph object as string values on `_draw_`, `_ldraw_`, etc. attributes. The
SVG renderer (Batch 7) consumes the parsed form. This library converts raw
attribute strings into typed `XdotOp` arrays and serializes them back.

Reference: https://graphviz.org/docs/outputs/canon/#xdot

### Coordinate system — critical, read carefully

xdot coordinates are in **PostScript points** (1 pt = 1/72 inch), with the
origin at the **lower-left** of the graph bounding box, **Y increasing
upward** (PostScript/mathematical convention). This is opposite to SVG, which
has origin at top-left with Y increasing downward.

**The Y-axis flip is NOT applied in this module.** All parsed coordinate
fields carry PostScript Y-up values. The SVG renderer (T28) applies the flip
at emit time:

```
y_svg = graphHeightPt - y_xdot
```

For image rects (lower-left origin in xdot): `y_svg = graphHeightPt - (y_xdot + h)`.

Every coordinate field in the exported types must carry a JSDoc comment
marking it as PostScript Y-up, e.g.:

```typescript
/** x coordinate in PostScript points. Y-up origin (lower-left). */
x: number;
/** y coordinate in PostScript points. Y-up origin; caller flips for SVG. */
y: number;
```

This is the only place this comment discipline is required in this task; it
exists to prevent the renderer author from accidentally treating these as SVG
coordinates.

### Gradient promotion

The wire characters `C` and `c` are used for both solid and gradient colors.
During parsing, after reading the color string blob, inspect the first
character: `[` means linear gradient → `xd_grad_fill_color` or
`xd_grad_pen_color`; `(` means radial gradient → same. Otherwise solid.

### `colorTypeXDot` is unimplemented in C

`colorTypeXDot` is declared in `xdot.h` but has no implementation anywhere in
the C source tree. Do not implement it. Do not export it.

### Solid color string ownership

In `parseXDotColor` in the C source, solid color strings (`xd_none`) point
into the caller's buffer (not heap-allocated separately). In TypeScript,
string values are always owned; this distinction does not apply.

## TEST DISCIPLINE — Non-Negotiable

**Tests are written before implementation. Expected values come from C source
only. Tests are never changed to match code output.**

Mandatory workflow:
1. Read `xdot.c` and `xdot.h` fully before writing any TypeScript.
2. Derive every expected value (wire format, parse results, round-trip
   output) directly from the C source. Where numeric output is needed,
   trace through the C code or run the C binary to obtain ground truth.
3. Write `xdot.test.ts` with those C-derived expected values as assertions.
4. Then write `index.ts` to satisfy the tests.
5. If a test fails: re-read the C, fix the TypeScript. Never touch the
   assertion.

**If a failing test cannot be fixed without changing its assertion, STOP.**
Log to `decision-journal.md` and wait for human input. This is Stop
Condition 8 in the mission README (AD-13).

## Task

Port the full public API of `lib/xdot` to TypeScript:

1. **Parsing**: `parseXDot(s: string): Xdot | null` — parses an xdot
   attribute string. Returns null if no ops were parsed. Sets
   `XDOT_PARSE_ERROR` flag in `flags` on bad input but returns the parsed
   prefix (same as C). Stops at the first unrecognized op character.

2. **Parsing with callback dispatch**: `parseXDotF(s: string, opFns: Partial<OpFunctions>, sz?: number): Xdot | null`
   — like `parseXDot` but invokes callback functions indexed by `XopKind`
   as each op is parsed.

3. **Append parsing**: `parseXDotFOn(s: string, opFns: Partial<OpFunctions>, x: Xdot): Xdot | null`
   — parses and appends ops to an existing `Xdot` object.

4. **Serialization**: `sprintXDot(x: Xdot): string` — serializes to xdot
   wire format. Numbers formatted to 2 decimal places with trailing zeros
   stripped (including the decimal point if integer). Trailing space after
   each op except the last.

5. **JSON**: `jsonXDot(x: Xdot): string` — serializes to JSON. Each op
   becomes `{"<char>": <value>}`. Output wrapped in a JSON array. Experimental
   format; match the C output exactly.

6. **Free**: `freeXDot(x: Xdot): void` — releases resources. In TypeScript
   this is a no-op for GC purposes, but still call user `freefunc` on each
   op if set (for callers that use the extension mechanism).

7. **Stats**: `statXDot(x: Xdot, sp: XdotStats): boolean` — populate stats.
   Returns false on success (C convention: 0 = success), true if either
   argument is null/undefined.

8. **Color parsing**: `parseXDotColor(s: string): XdotColor | null` — parses
   a color value (solid or gradient). Returns null on error.

9. **Color free**: `freeXDotColor(c: XdotColor): void` — no-op in TS
   (GC), but provided for API symmetry.

### String encoding

`<len>-<text>` format: `len` counts source characters before escape
expansion. Backslash escaping: `\` is counted unless itself preceded by `\`.
`\\` = two source chars, one literal backslash. Implement this faithfully in
both parser and serializer.

### Op ordering contract

State-setting ops (`xd_fill_color`, `xd_pen_color`, `xd_font`, `xd_style`,
`xd_fontchar`) appear before the drawing ops they affect within the same
attribute string, by convention of the writer. The parser does not enforce
this; it stores ops in input order.

### Buffer strategy

Initial allocation: 100 ops (`XDBSIZE`). Double on overflow. Shrink to exact
count at end. Match this growth pattern exactly — it affects memory behavior
visible to callers using `parseXDotFOn` to accumulate across multiple
attribute strings.

## Write-Set

- `src/xdot/index.ts`
- `src/xdot/xdot.test.ts`

## Read-Set

- `~/git/graphviz/lib/xdot/xdot.h` — full type definitions and API
- `~/git/graphviz/lib/xdot/xdot.c` — full implementation (parsing loop,
  serializers, gradient parsing, buffer strategy)
- `~/git/graphviz/docs/architecture/lib/xdot.md` — behavioral subtleties

## Architecture Decisions

- xdot coordinate flip: Y values in all exported types are in PostScript Y-up
  coordinates. The flip is applied in the SVG renderer (T28/Batch 7), not
  here. All coordinate fields carry a JSDoc comment marking them as Y-up.

## Interface Contracts

```typescript
export const XDOT_PARSE_ERROR = 0x1;

export type XdotGradType = 'none' | 'linear' | 'radial';

export interface XdotColorStop {
  frac: number;    // [0.0, 1.0]
  color: string;   // heap-allocated color string
}

export interface XdotLinearGrad {
  /** x0 in PostScript points. Y-up origin; caller flips for SVG. */
  x0: number;
  /** y0 in PostScript points. Y-up origin; caller flips for SVG. */
  y0: number;
  /** x1 in PostScript points. Y-up origin; caller flips for SVG. */
  x1: number;
  /** y1 in PostScript points. Y-up origin; caller flips for SVG. */
  y1: number;
  stops: XdotColorStop[];
}

export interface XdotRadialGrad {
  /** x0 in PostScript points. Y-up origin; caller flips for SVG. */
  x0: number;
  /** y0 in PostScript points. Y-up origin; caller flips for SVG. */
  y0: number;
  r0: number;
  /** x1 in PostScript points. Y-up origin; caller flips for SVG. */
  x1: number;
  /** y1 in PostScript points. Y-up origin; caller flips for SVG. */
  y1: number;
  r1: number;
  stops: XdotColorStop[];
}

export type XdotColor =
  | { type: 'none'; clr: string }
  | { type: 'linear'; ling: XdotLinearGrad }
  | { type: 'radial'; ring: XdotRadialGrad };

export type XdotAlign = 'left' | 'center' | 'right';

export interface XdotPoint {
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  x: number;
  /** y coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  y: number;
  z: number;  // always 0; retained for wire-format fidelity
}

export interface XdotRect {
  /**
   * For ellipses: center x. For images: lower-left x.
   * PostScript points. Y-up origin; caller flips for SVG.
   */
  x: number;
  /**
   * For ellipses: center y. For images: lower-left y.
   * PostScript points. Y-up origin; caller flips for SVG.
   */
  y: number;
  /** For ellipses: half-width (rx). For images: full width. */
  w: number;
  /** For ellipses: half-height (ry). For images: full height. */
  h: number;
}

export interface XdotPolyline {
  pts: XdotPoint[];
}

export interface XdotText {
  /**
   * Baseline anchor x in PostScript points.
   * Y-up origin; caller flips for SVG.
   */
  x: number;
  /**
   * Baseline anchor y in PostScript points.
   * Y-up origin; caller flips for SVG.
   */
  y: number;
  align: XdotAlign;
  width: number;  // advisory rendered width in points
  text: string;
}

export interface XdotImage {
  pos: XdotRect;
  name: string;
}

export interface XdotFont {
  size: number;
  name: string;
}

export type XdotKind =
  | 'filled_ellipse' | 'unfilled_ellipse'
  | 'filled_polygon' | 'unfilled_polygon'
  | 'filled_bezier'  | 'unfilled_bezier'
  | 'polyline'
  | 'text'
  | 'fill_color' | 'pen_color'
  | 'font' | 'style' | 'image'
  | 'grad_fill_color' | 'grad_pen_color'
  | 'fontchar';

export type XdotOp =
  | { kind: 'filled_ellipse' | 'unfilled_ellipse'; ellipse: XdotRect }
  | { kind: 'filled_polygon' | 'unfilled_polygon'; polygon: XdotPolyline }
  | { kind: 'filled_bezier' | 'unfilled_bezier'; bezier: XdotPolyline }
  | { kind: 'polyline'; polyline: XdotPolyline }
  | { kind: 'text'; text: XdotText }
  | { kind: 'fill_color' | 'pen_color'; color: string }
  | { kind: 'grad_fill_color' | 'grad_pen_color'; gradColor: XdotColor }
  | { kind: 'font'; font: XdotFont }
  | { kind: 'style'; style: string }
  | { kind: 'image'; image: XdotImage }
  | { kind: 'fontchar'; fontchar: number };

export interface Xdot {
  ops: XdotOp[];
  flags: number;  // XDOT_PARSE_ERROR bit
}

export interface XdotStats {
  cnt: number;
  nEllipse: number;
  nPolygon: number; nPolygonPts: number;
  nPolyline: number; nPolylinePts: number;
  nBezier: number; nBezierPts: number;
  nText: number;
  nFont: number;
  nStyle: number;
  nColor: number;
  nImage: number;
  nGradcolor: number;
  nFontchar: number;
}
```

## Acceptance Criteria

1. `parseXDot('e 100 200 50 30')` produces a single `unfilled_ellipse` op
   with `ellipse.x = 100`, `ellipse.y = 200`, `ellipse.w = 50`,
   `ellipse.h = 30`. The `y` value is 200 (PS coordinates, not flipped).
2. All coordinate fields on `XdotPoint`, `XdotRect`, `XdotText`,
   `XdotLinearGrad`, and `XdotRadialGrad` carry the JSDoc comment specifying
   Y-up PS coordinates.
3. Round-trip: for every op kind, `parseXDot(sprintXDot(parseXDot(s)!))` has
   ops equal to `parseXDot(s)` for valid input strings. Test with at least one
   example of each op kind.
4. Gradient promotion: `parseXDot('C 14-[0 0 1 1 2 0 5-red 1 4-blue]')` sets
   `kind = 'grad_fill_color'` (not `'fill_color'`).

## Observability

N/A — pure parser/serializer, no I/O.

## Rollback

Reversible. No other module imports from `src/xdot/` until T24 (emit).

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/xdot/xdot.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- 90% line coverage, 90% branch coverage (vitest `--coverage`)
