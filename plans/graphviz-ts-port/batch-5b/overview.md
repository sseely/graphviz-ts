# Batch 5b — Common Layer Part B: Labels, Text, Arrows

## Summary

Batch 5b ports the three rendering-support subsystems of `lib/common` that
depend on the type and color infrastructure established in Batch 5a.

- **T20 — html-labels**: Port the HTML-like label parser from
  `lib/common/htmltable.c` (1941 lines). Produces an AST of tables, cells,
  text spans, and images.
- **T21 — text-measure**: Implement the `TextMeasurer` interface (AD-10) with
  two concrete implementations: the 11-family LUT from
  `lib/common/textspan_lut.h` and a Canvas 2D `measureText` wrapper.
- **T22 — arrows**: Port all arrow type definitions and rendering from
  `lib/common/arrows.c` (1361 lines).

All three tasks are independent of each other within this batch and run in
parallel.

## Dependencies

- Requires: Batch 5a complete (T18 for types, T19 for color)
- Parallel within batch: T20 ‖ T21 ‖ T22
- Blocks: Batch 5c (T23, T24)

## Task Table

| ID  | Description        | ‖/→ | Writes                                                                  | Depends On |
|-----|--------------------|-----|-------------------------------------------------------------------------|------------|
| T20 | HTML label parser  | ‖   | src/common/htmltable.ts, src/common/htmltable.test.ts                   | —          |
| T21 | Text measurement   | ‖   | src/common/textmeasure.ts, src/common/textmeasure.test.ts               | —          |
| T22 | Arrow types        | ‖   | src/common/arrows.ts, src/common/arrows.test.ts                         | —          |
