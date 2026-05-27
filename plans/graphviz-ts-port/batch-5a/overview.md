# Batch 5a — Common Layer Part A: Types & Color

## Summary

Batch 5a ports the two foundational pieces of `lib/common` that everything
else in the common layer depends on. T18 establishes the shape catalogue and
layout parameter types; T19 establishes the color system. Both are
independent of each other and run in parallel.

- **T18 — types-shapes**: Port `lib/common/types.h` layout types and the full
  `Shapes[]` table from `lib/common/shapes.c`. Every named shape must be
  present — the C source is the completeness spec.
- **T19 — color**: Port the color parsing, HSV↔RGB conversion, X11 name
  lookup, SVG name lookup, and gradient support from `lib/common/colxlate.c`.

Neither task imports from the other. Both import geometry types from Batch 1
(`src/common/geom.ts`) and utility helpers from Batch 2.

## Dependencies

- Requires: Batch 4 complete
- Parallel within batch: T18 ‖ T19
- Blocks: Batch 5b (T20, T21, T22) and Batch 5c (T23, T24)

## Task Table

| ID  | Description                     | ‖/→ | Writes                                                               | Depends On |
|-----|---------------------------------|-----|----------------------------------------------------------------------|------------|
| T18 | Common types and shape catalogue | ‖  | src/common/types.ts, src/common/shapes.ts, src/common/shapes.test.ts | —          |
| T19 | Color system                    | ‖   | src/common/color.ts, src/common/color.test.ts                        | —          |
