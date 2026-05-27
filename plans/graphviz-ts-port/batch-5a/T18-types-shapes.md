# T18 — Common Types and Shape Catalogue

## Context

The project is a faithful TypeScript 5.x port of Graphviz `lib/`, targeting
SVG output. TypeScript strict mode, Vitest, esbuild, EPL-2.0, no Node.js in
core.

`lib/common/types.h` is the central type definition file for all layout
engines. It defines the core structs for graph, node, and edge layout info
that are accessed via `GD_*`, `ND_*`, `ED_*` macros in C. Per AD-1, these
macros are replaced with plain typed fields on `GraphInfo`, `NodeInfo`,
`EdgeInfo` TypeScript classes.

`lib/common/shapes.c` defines the `Shapes[]` table — the built-in node shape
catalogue. Per the typescript-port.md faithfulness constraint: "Every shape in
shapes.c must be present — none may be skipped." The C source is the
completeness spec.

This task also ports `lib/common/const.h` (named constants) and the
`layout_t`, `polygon_t`, `shape_desc`, `shape_functions`, `rank_t`, `port`,
`splineInfo`, `textlabel_t`, `bezier`, `splines`, `path`, and `pathend_t`
types.

## Task

### Part 1: `src/common/types.ts`

Port all types from `lib/common/types.h` to TypeScript. Per AD-1, the
`GD_*`/`ND_*`/`ED_*` macro system is replaced with plain typed fields.
Per AD-7, `ND_alg` per-engine data uses a discriminated union with a `kind`
field.

Types to port:

- `Port` (from `struct port`) — internal edge endpoint specification
- `SplineInfo` — callback table for edge routing
- `PathendT` (from `pathend_t`) — node box + port for edge routing
- `Path` (from `struct path`) — internal edge spline specification
- `Bezier` (from `struct bezier`) — cubic Bezier with sflag/eflag/sp/ep
- `Splines` (from `struct splines`) — array of Bezier + bounding box
- `TextlabelT` (from `textlabel_t`) — text label with font, color, HTML/plain
- `PolygonT` (from `polygon_t`) — mutable shape info for a node
- `GraphvizPolygonStyle` (from `graphviz_polygon_style_t`) — style bit flags
- `ShapeFunctions` (from `shape_functions`) — shape callback table
- `ShapeKind` (from `shape_kind` enum) — SH_UNSET, SH_POLY, SH_RECORD,
  SH_POINT, SH_EPSF
- `ShapeDesc` (from `shape_desc`) — read-only shape descriptor
- `LayoutT` (from `layout_t`) — per-graph layout parameters (quantum, scale,
  ratio, dpi, margin, page, size, etc.)
- `RatioT` (from `ratio_t` enum) — R_NONE, R_VALUE, R_FILL, R_COMPRESS,
  R_AUTO, R_EXPAND
- `RankT` (from `rank_t`) — per-rank information (nodes, heights, etc.)
- `FieldT` (from `field_t`) — record shape field
- `NlistT` (from `nlist_t`) — node list
- `GraphInfo`, `NodeInfo`, `EdgeInfo` — layout engine info structs with all
  optional engine-specific fields per AD-1. Use the TypeScript type mapping
  from `typescript-port.md` (Layer 2) as the base; expand with any fields
  from `types.h` not already present there.

Per AD-8: `NodeInfo.rank` carries a JSDoc comment documenting its dual-use
as x-coordinate during the dot position phase.

### Part 2: `src/common/shapes.ts`

Port the `Shapes[]` table from `lib/common/shapes.c` as a TypeScript array
of `ShapeDesc` objects. **Every named shape must be present.**

The complete shape name list from the C `Shapes[]` table (verified from
source):

```
box, polygon, ellipse, oval, circle, point, egg, triangle,
none, plaintext, plain, diamond, trapezium, parallelogram, house,
pentagon, hexagon, septagon, octagon, note, tab, folder, box3d,
component, cylinder, rect, rectangle, square, doublecircle,
doubleoctagon, tripleoctagon, invtriangle, invtrapezium, invhouse,
underline, Mdiamond, Msquare, Mcircle,
promoter, cds, terminator, utr, insulator, ribosite, rnastab,
proteasesite, proteinstab, primersite, restrictionsite, fivepoverhang,
threepoverhang, noverhang, assembly, signature, rpromoter, larrow,
rarrow, lpromoter,
record, Mrecord, epsf, star
```

The first entry (`box`) is the default returned when no matching shape name
is found (matching C behavior where `Shapes[0]` is the fallback).

Each `ShapeDesc` entry carries:
- `name: string`
- `polygon: PolygonT | null` — polygon geometry (null for record/Mrecord/epsf)
- `kind: ShapeKind` — SH_POLY, SH_RECORD, SH_POINT, SH_EPSF, or variant

Export:

```typescript
export function bindShape(name: string): ShapeDesc;
```

`bindShape` looks up `name` in the `Shapes` array (case-sensitive, as in C)
and returns the matching descriptor. If not found, returns `Shapes[0]` (box).

**Polygon shape with 0 sides:** `polygon` shape with `sides = 0` is valid in
C (produces a circle-like polygon). Handle this case as C does — do not
throw, do not default to another shape.

**Unknown shape name fallback:** An unknown name passed to `bindShape` returns
`Shapes[0]` (box), matching C behavior in `bind_shape`. This is different
from the `ellipse` fallback stated in some documentation — the C source uses
`Shapes[0]` which is `box`.

Export the full `Shapes` array as a readonly array for callers that need to
enumerate all shapes.

## Write-Set

- `src/common/types.ts`
- `src/common/shapes.ts`
- `src/common/shapes.test.ts`

## Read-Set

- `~/git/graphviz/lib/common/types.h` — full type definitions
- `~/git/graphviz/lib/common/shapes.c` — Shapes[] table (lines 292–360 have
  the table; read the full file for polygon geometry definitions)
- `~/git/graphviz/docs/architecture/lib/common.md` — file index and type
  descriptions
- `~/git/graphviz/docs/architecture/typescript-port.md` — TypeScript type
  mapping (Layer 2 and Layer 3)
- `~/git/graphviz-ts/plans/graphviz-ts-port/decisions.md` — AD-1, AD-7, AD-8

## Architecture Decisions

- **AD-1**: `GD_*`/`ND_*`/`ED_*` macro system → plain typed fields on
  `GraphInfo`, `NodeInfo`, `EdgeInfo`. All engine-specific fields are optional
  and zero-initialized on construction.
- **AD-7**: `NodeInfo.alg` is a discriminated union with a `kind` field.
  Never use `unknown` or type casting.
- **AD-8**: `NodeInfo.rank` carries JSDoc documenting dual-use as x-coordinate
  during the dot position phase.

## Interface Contracts

```typescript
// Sentinel shape names
export const DEFAULT_SHAPE_NAME = 'box';  // Shapes[0]; fallback for unknown names

export interface ShapeDesc {
  readonly name: string;
  readonly polygon: PolygonT | null;
  readonly kind: ShapeKind;
}

/**
 * Returns the ShapeDesc for `name`, or Shapes[0] (box) if not found.
 * Lookup is case-sensitive, matching C bind_shape behavior.
 */
export function bindShape(name: string): ShapeDesc;

/** All built-in shapes. Shapes[0] is the default (box). */
export const Shapes: readonly ShapeDesc[];
```

## Acceptance Criteria

1. All 64 named shapes from the `Shapes[]` table in `shapes.c` are present in
   the exported `Shapes` array. Test: `Shapes.map(s => s.name)` includes every
   name in the list above.
2. Polygon shape with 0 sides is handled without throwing: `bindShape('polygon')`
   with `sides = 0` in the returned descriptor is valid and `polygon.sides === 0`.
3. Unknown shape name falls back to `Shapes[0]`: `bindShape('does_not_exist').name === 'box'`.
4. `NodeInfo.rank` field has a JSDoc comment containing "x-coordinate" and
   "position phase" (or equivalent dual-use documentation).

## Observability

N/A — pure type definitions and data table.

## Rollback

Reversible. `src/common/types.ts` and `src/common/shapes.ts` have no side
effects. Removal only affects downstream importers.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/common/shapes.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- 90% line coverage, 90% branch coverage on `src/common/shapes.ts`
