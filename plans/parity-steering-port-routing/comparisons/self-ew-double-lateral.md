# Comparison page — `digraph{A:e->A:w}` (lateral self-loop)

**Status:** journal-EXCLUDED at SR6 (2026-06-14). Out of the SR6 routing seam
(self-loop.ts) — the divergence traces into the **frozen** `selfRightSpace`
node-width reservation (`src/common/splines-selfedge.ts`, AD5 black box), not
the self-edge routing seam SR6 owns.

A lateral self-loop (`A:e` exits the RIGHT face, `A:w` enters the LEFT face)
makes the loop bulge sideways past both vertical faces of A. dot reserves node
width for that bulge in the position pass via
`make_LR_constraints → selfRightSpace` (TS: `position-aux.ts:selfWidth →
selfRightSpace`). For the lateral case TS reserves a different width than C, so
node A's center shifts — and the shift carries into **every** edge incident to
A, not just the self-loop.

Side-by-side renders (graph has `; A->B` to expose the node-center shift):
[dot 15.0.0](self-ew-dot1500.svg) · [graphviz-ts](self-ew-ts.svg)

## Geometry (`digraph{A:e->A:w; A->B}`, SVG frame)

| pt | dot 15.0.0 (self-loop) | graphviz-ts (self-loop) | Δ |
|----|-----------|-------------|---|
| 0 (start) | 65.77,-90.00 | 71.01,-90.00 | 5.24 |
| 1 | 83.52,-108.00 | 89.01,-108.00 | 5.49 |
| 2 | 83.52,-144.00 | 89.01,-144.00 | 5.49 |
| 3 | 38.52,-144.00 | 44.01,-144.00 | 5.49 |
| 4 | 0.38,-144.00 | 5.69,-144.00 | 5.31 |
| 5 | -5.44,-118.13 | 0.00,-117.89 | 5.45 |
| 6 | 4.49,-99.29 | 10.27,-99.03 | 5.79 |
| arrow tip | 10.37,-91.22 | 16.10,-91.21 | 5.73 |

The plain `A->B` edge incident to A also shifts: its start x is **38.52** in
dot vs **44.01** in ts — the same ~5.5pt as the self-loop. That confirms the
divergence is **node A's reserved width**, not the loop spline itself.

## Diagnosis

- **The loop shape is faithful.** Both render the same lateral double-bulge
  (over the top to x≈83/89, down the left past x=0 / x=-5.44, back in). The
  vertical extent (y to -144) matches exactly.
- **The whole node-A region is translated ~5.5pt in x.** Because the A->B edge
  shifts by the identical amount, the cause is the width A reserves for the
  lateral loop, computed by `selfRightSpace` (frozen common code), feeding
  `selfWidth` in `make_LR_constraints`.
- This is **not** a `Proutespline`/`Pshortestpath` numeric divergence and not a
  self-loop routing-seam (self-loop.ts) issue. It is a node-width-reservation
  difference inside the AD5 frozen `splines-selfedge.ts`.

## Why excluded (not fixed) at SR6

- SR6's seam is `self-loop.ts` (the dot-side dispatch). The self-loop routing is
  already faithful — plain `A->A` is **byte-identical** to dot 15.0.0, and the
  n/s side-port self-loops (`A:n->A:s`, `A:n->A`) match within 0.32pt and are
  pinned in `src/layout/dot/self-loop-oracle.test.ts`.
- The lateral-loop width reservation lives in `src/common/splines-selfedge.ts`
  (`selfRightSpace`), which is the AD5 frozen black box. Per the mission
  boundary, a >0.5pt divergence tracing into frozen common code is surfaced,
  not chased.
- Flagged as a follow-up: lateral (e/w) self-loop width reservation parity in
  the frozen `selfRightSpace` — a separate concern from steering-port edge
  routing.
