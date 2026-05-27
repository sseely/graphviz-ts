# T2 — Geometry Primitives

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC. T2
ports the fundamental geometric types from `lib/common/geom.h` and the `port`
struct from `lib/common/types.h`. These types are the vocabulary for all
downstream layout and rendering code.

## Task

Create `src/model/geom.ts` containing TypeScript equivalents of all geometric
primitive types declared in `lib/common/geom.h` and the `port` struct from
`lib/common/types.h`. Export all types from `src/model/index.ts`. Include the
`boxContains` utility function that matches the C `CONTAINS` macro behavior.

## Write-Set

```
src/model/geom.ts
src/model/index.ts  (create or update to re-export from geom.ts)
```

## Read-Set

- `~/git/graphviz/lib/common/geom.h` — authoritative source for Point, Box,
  linef structs and CONTAINS macro semantics
- `~/git/graphviz/lib/common/types.h` — authoritative source for the `port`
  struct (lines 48–64 in that file)
- `~/git/graphviz/docs/architecture/typescript-port.md` — TypeScript type
  mapping section (Layer 0 and Layer 3)

## Architecture Decisions

- AD-1: GD_*/ND_*/ED_* → typed fields (these types feed into GraphInfo,
  NodeInfo, EdgeInfo; no macro machinery)

## Interface Contracts

The following types must be exported from `src/model/geom.ts` and
re-exported from `src/model/index.ts`:

```typescript
// From lib/common/geom.h: struct pointf_s { double x, y; }
export type Point = { x: number; y: number };

// From lib/common/geom.h: typedef struct { pointf LL, UR; } boxf;
// Note: C uses uppercase LL/UR — TypeScript uses ll/ur (camelCase convention).
// EXCEPTION: Field names must match C struct names exactly per the spec.
// C declares: LL and UR (uppercase). Use ll and ur.
export type Box = { ll: Point; ur: Point };

// From lib/common/types.h: typedef struct bezier
// Fields: list (control points), size (count), sflag (start-arrow bits),
// eflag (end-arrow bits), sp (start arrow attachment), ep (end arrow attachment)
export type Bezier = {
  list: Point[];    // C: pointf *list
  size: number;     // C: size_t size
  sflag: number;    // C: uint32_t sflag
  eflag: number;    // C: uint32_t eflag
  sp: Point;        // C: pointf sp
  ep: Point;        // C: pointf ep
};

// From lib/common/types.h: typedef struct splines
export type Spline = {
  list: Bezier[];   // C: bezier *list
  size: number;     // C: size_t size
  bb: Box;          // C: boxf bb
};

// From lib/common/types.h: typedef struct port
export type Port = {
  p: Point;              // C: pointf p — aiming point relative to node center
  theta: number;         // C: double theta — slope in radians
  bp: Box | null;        // C: boxf *bp — null when no bounding box port target
  defined: boolean;      // C: bool defined
  constrained: boolean;  // C: bool constrained
  clip: boolean;         // C: bool clip
  dyna: boolean;         // C: bool dyna
  order: number;         // C: unsigned char order
  side: number;          // C: unsigned char side — bitwise OR of sides
  name: string | null;   // C: char *name — null if not explicitly given
};
```

### Utility function

```typescript
// Matches C CONTAINS macro: true if b0 completely contains b1
// C: ((b0).UR.x >= (b1).UR.x) && ((b0).UR.y >= (b1).UR.y) &&
//    ((b0).LL.x <= (b1).LL.x) && ((b0).LL.y <= (b1).LL.y)
export function boxContains(b0: Box, b1: Box): boolean;
```

### Constants (from geom.h and const.h)

```typescript
export const POINTS_PER_INCH = 72;
export const LINESPACING = 1.20;  // from lib/common/const.h
```

## Field Name Note

C's `geom.h` uses `LL` and `UR` (uppercase) for box corners. These map to
`ll` and `ur` in TypeScript by the camelCase naming convention. The
`typescript-port.md` architecture doc uses `ll`/`ur` consistently. Use `ll`
and `ur`.

## Acceptance Criteria

- Given the `Box` type, when `ll` and `ur` are accessed, then both are typed
  as `Point` (not `point` with uppercase fields — this is the floating-point
  `boxf`, not the integer `box`).
- Given `boxContains({ ll: {x:0,y:0}, ur: {x:10,y:10} }, { ll: {x:2,y:2}, ur: {x:8,y:8} })`,
  then it returns `true`.
- Given `boxContains({ ll: {x:0,y:0}, ur: {x:5,y:5} }, { ll: {x:2,y:2}, ur: {x:8,y:8} })`,
  then it returns `false` (b1 extends beyond b0).
- Given `src/model/index.ts`, then it re-exports `Point`, `Box`, `Bezier`,
  `Spline`, `Port`, `boxContains`, `POINTS_PER_INCH`, and `LINESPACING`.

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for this module
- One commit: `feat(model): add geometry primitive types`
