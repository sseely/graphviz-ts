# T22 — Arrow Types

## Context

The project is a faithful TypeScript 5.x port of Graphviz `lib/`, targeting
SVG output. TypeScript strict mode, Vitest, esbuild, EPL-2.0, no Node.js in
core.

`lib/common/arrows.c` (1361 lines) implements all edge arrow type definitions,
arrow shape parsing, clipping of edge splines to arrow shapes, and drawing
calls. `lib/common/arrows.h` declares the public API.

The arrow system supports compound arrow types: a single `arrowhead` or
`arrowtail` attribute value like `"odot"` or `"vee"` is parsed as a sequence
of up to 4 arrow modifiers stacked together. The parser decomposes a string
into a list of `arrowType` components.

### Arrow type names (from arrows.c — all must be present)

The C `arrow_type[]` table in `arrows.c` contains these type names. All must
be present in the TypeScript port:

`normal`, `inv`, `dot`, `odot`, `none`, `tee`, `empty`, `invempty`,
`diamond`, `odiamond`, `ediamond`, `open`, `halfopen`, `vee`, `crow`,
`box`, `obox`, `curve`, `icurve`, `ocurve`, `olcurve`, `orcurve`,
`lcurve`, `rcurve`

(verify the complete list by reading `arrows.c` — additional entries may
exist beyond this list)

### Compound arrows

An arrow type string like `"odot"` decomposes to `['o', 'dot']` meaning
"open dot". Modifiers: `l` (left half only), `r` (right half only), `o`
(open/outline only). These modifiers can precede any base arrow name.

### Clip and draw

The main public functions are:

```typescript
export function arrowEndClip(
  e: Edge,
  ps: Point[],  // control points
  psflag: number,
  eflag: number,
  sp: Port,
  ep: Port,
  job: RenderJob,
): void;
```

This clips the spline at the arrowhead/tail attachment points and emits
drawing calls. The clipping is geometric: the spline is shortened to meet the
arrow shape's anchor point.

Port `lib/common/arrows.c` in full. Every arrow drawing function
(`arrow_type_normal`, `arrow_type_crow`, etc.) must produce the correct
polygon/bezier control points as computed in C.

## Task

Port `lib/common/arrows.c` and `lib/common/arrows.h` to `src/common/arrows.ts`.

Export:
- All arrow type names as a constant array `ARROW_NAMES: readonly string[]`
- `parseArrow(str: string): ArrowComponent[]` — parse a compound arrow string
- `arrowEndClip(e, ps, psflag, eflag, sp, ep, job): void`
- `arrowStartClip(e, ps, psflag, eflag, sp, ep, job): void`

Port all internal geometry functions for each arrow shape. Do not use
placeholder implementations — every arrow shape must produce the correct
geometry.

## Write-Set

- `src/common/arrows.ts`
- `src/common/arrows.test.ts`

## Read-Set

- `~/git/graphviz/lib/common/arrows.c` — full implementation (read in full —
  all 1361 lines; the arrow_type[] table and each drawing function)
- `~/git/graphviz/lib/common/arrows.h` — public API declarations

## Architecture Decisions

No task-specific architecture decisions.

## Interface Contracts

```typescript
export interface ArrowComponent {
  name: string;    // base arrow type name (e.g., 'normal', 'dot', 'vee')
  open: boolean;   // 'o' modifier
  left: boolean;   // 'l' modifier (left half only)
  right: boolean;  // 'r' modifier (right half only)
}

/**
 * All arrow type names from the arrow_type[] table in arrows.c.
 * Must include every entry; no additions, no omissions.
 */
export const ARROW_NAMES: readonly string[];

/**
 * Parse a compound arrow type string into its components.
 * E.g., "odot" → [{ name: 'dot', open: true, left: false, right: false }]
 * E.g., "vee" → [{ name: 'vee', open: false, left: false, right: false }]
 */
export function parseArrow(str: string): ArrowComponent[];
```

## Acceptance Criteria

1. All arrow type names from `arrows.c` `arrow_type[]` table are present in
   `ARROW_NAMES`. Test: verify `ARROW_NAMES.includes('normal')`,
   `ARROW_NAMES.includes('none')`, `ARROW_NAMES.includes('crow')`, and that
   `ARROW_NAMES.length` matches the C table entry count (read the file to
   verify the exact count).
2. `"normal"` arrow renders as a filled triangle: `parseArrow('normal')`
   returns `[{ name: 'normal', open: false, left: false, right: false }]`.
3. `"none"` arrow renders nothing: `parseArrow('none')` returns
   `[{ name: 'none', open: false, left: false, right: false }]`, and the
   draw function for 'none' emits zero drawing calls.
4. Compound `"odot"` is composed correctly: `parseArrow('odot')` returns
   `[{ name: 'dot', open: true, left: false, right: false }]`.

## Observability

N/A — pure algorithm module.

## Rollback

Reversible. Nothing imports from `src/common/arrows.ts` until T24 (emit).

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/common/arrows.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- 90% line coverage, 90% branch coverage (vitest `--coverage`)
