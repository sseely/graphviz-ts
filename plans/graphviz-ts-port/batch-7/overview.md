# Batch 7 — Renderers

## Summary

Batch 7 implements the four renderer plugins that together produce all output
formats in scope (AD-12). Each renderer implements the `RendererPlugin`
interface from `src/gvc/context.ts` and registers itself via static
registration (AD-2).

All four tasks are independent — they write to non-overlapping files and share
only read access to the C source and the interface types defined in Batch 6.
They run in parallel.

The SVG renderer (T28) is the highest-priority target for the entire project
and the primary vehicle for validating layout correctness. T29–T31 are required
for full format coverage but do not block SVG testing.

## Dependencies

Batch 7 requires Batch 6 (all three tasks: T25, T26, T27) to be complete.
`RendererPlugin`, `RenderJob`, `ObjState`, flag constants, and
`transformPoint` must all exist before any renderer can compile.

## Task Table

| ID | Description | ‖/→ | Writes | Depends On |
|----|-------------|-----|--------|------------|
| T28 | SVG renderer | ‖ | src/render/svg.ts, src/render/svg.test.ts | T25, T26, T27 |
| T29 | DOT and XDOT renderer | ‖ | src/render/dot.ts, src/render/dot.test.ts | T25, T26, T27 |
| T30 | JSON renderer | ‖ | src/render/json.ts, src/render/json.test.ts | T25, T26, T27 |
| T31 | plain, IMAP, and CMAPX renderers | ‖ | src/render/map.ts, src/render/map.test.ts | T25, T26, T27 |
