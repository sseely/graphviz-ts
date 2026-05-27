# Batch 10 — Remaining Layout Engines and Pack

## Summary

Batch 10 ports the five remaining layout engines (circo, twopi, osage,
patchwork) plus the rectangle-packing library (lib/pack) that osage and
any engine using the `pack` graph attribute depend on.

**T48 runs first (pack).** Every other task in this batch either depends
on lib/pack directly (osage) or uses packSubgraphs for multi-component
layout (circo, twopi). T48 must complete before any other task begins.

**T49, T50, T51, T52 run in parallel after T48.** All four engines have
non-overlapping write-sets and their only shared dependency is T48.

Two coordinate-space pitfalls span multiple tasks:

**PS2INCH = 1/72 (T48, T49, T50, T52):** `shiftGraphs` in lib/pack
converts `ND_pos` (inches) from point-space delta using `PS2INCH`.
Mixing the two spaces silently produces coordinates off by 72×. Every
site in the TypeScript port that converts between the two must call
the same `ps2inch(pts: number): number` helper exported from
`src/layout/pack/index.ts`.

**ND_alg freed before spline routing (T49, T50, T52):** circo, twopi,
and patchwork all free their per-node algorithm data (ndata/rdata)
before calling spline routing, because the spline router reuses
`NodeInfo.alg`. The pattern must be preserved exactly: free the block,
null the field, then call the spline router.

**Contiguous allocation for per-node data (T49, T50, T52):** All three
engines allocate their per-node structs as one contiguous block indexed
by node position. The TypeScript port uses a single typed array and
assigns each node's `NodeInfo.alg` to point at the correct index. This
is a memory-layout invariant, not just a style choice — the cleanup
function frees only `alg` on the first node, not each node individually.

## Dependencies

- Requires: Batches 1–9 complete
- T48 must complete before T49, T50, T51, T52
- T49 ‖ T50 ‖ T51 ‖ T52 run in parallel after T48

## Task Table

| ID  | Description                            | ‖/→ | Writes                                                                                                                                                          | Depends On |
|-----|----------------------------------------|-----|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|
| T48 | Rectangle packing (lib/pack)           | →   | src/layout/pack/index.ts, src/layout/pack/pack.test.ts                                                                                                          | —          |
| T49 | circo layout engine                    | ‖   | src/layout/circo/blocks.ts, src/layout/circo/circular.ts, src/layout/circo/position.ts, src/layout/circo/lists.ts, src/layout/circo/init.ts, src/layout/circo/index.ts, src/layout/circo/circo.test.ts | T48 |
| T50 | twopi layout engine                    | ‖   | src/layout/twopi/circle.ts, src/layout/twopi/init.ts, src/layout/twopi/index.ts, src/layout/twopi/twopi.test.ts                                                 | T48        |
| T51 | osage layout engine                    | ‖   | src/layout/osage/index.ts, src/layout/osage/osage.test.ts                                                                                                       | T48        |
| T52 | patchwork layout engine                | ‖   | src/layout/patchwork/index.ts, src/layout/patchwork/patchwork.test.ts                                                                                           | T48        |
