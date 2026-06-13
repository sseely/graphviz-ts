# Batch 5c — Common Layer Part C: Splines & Emit

## Summary

Batch 5c ports the two final major components of `lib/common` that depend on
the full preceding common layer plus the geometry primitives from Batch 4.

- **T23 — splines**: Port `lib/common/splines.c` (1375 lines). This is the
  high-level spline attachment layer (`clip_and_install`, `new_spline`,
  self-edge routing) that calls down into pathplan (T14) for obstacle-aware
  routing. It writes computed spline data to `EdgeInfo.spl`.
- **T24 — emit**: Port `lib/common/emit.c` (4365 lines). This is the central
  rendering dispatch that iterates the graph, applies coordinate conversions,
  and calls renderer callbacks in the correct order for every element.

T23 and T24 are independent of each other (non-overlapping write-sets) and run
in parallel. Both require Batch 5a, Batch 5b, and T14 (pathplan) to be
complete before starting.

## Dependencies

- Requires: Batch 5a complete (types, color), Batch 5b complete (labels,
  text, arrows), and T14 (pathplan) from Batch 4 complete
- Parallel within batch: T23 ‖ T24
- Blocks: Batch 6 (GVC Orchestration)

## Task Table

| ID  | Description         | ‖/→ | Writes                                                              | Depends On      |
|-----|---------------------|-----|---------------------------------------------------------------------|-----------------|
| T23 | Spline routing      | ‖   | src/common/splines.ts, src/common/splines.test.ts                  | T14, 5a, 5b     | [x] |
| T24 | Emit infrastructure | ‖   | src/common/emit.ts, src/common/emit.test.ts                        | T14, 5a, 5b     | [x] |
