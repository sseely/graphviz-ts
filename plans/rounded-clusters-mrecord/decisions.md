<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions (approved)

## AD-1: One shared rounded-box path emitter (extract `roundedDraw`'s core)
- Context: C calls a single `round_corners(job, AF, sides, style, filled)` from
  poly_gencode, record_gencode, and emit_clusters. The port's equivalent rounded
  branch (`roundedDraw` in `src/common/poly-shapes.ts`) is private and coupled to
  the poly ring `ShapeCtx`.
- Decision: extract the rounded-bezier core into a reusable exported helper that
  takes absolute corner points + the renderer + job + `filled`, and emits the
  rounded `<path>` via `renderer.bezier`. Refactor `roundedDraw` to call it so
  the poly path stays byte-identical. Cluster and record call the same helper.
- Consequences: faithful to C's single round_corners; no duplicated curve math;
  poly nodes unchanged (regression-checked).

## AD-2: Cluster — emit rounded path when `style` includes `rounded`
- Context: `renderOneCluster` (`src/gvc/device.ts:329`) always calls
  `renderer.polygon(rawPts, filled, job)`.
- Decision: parse the cluster `style` flags (already available via
  `parseStyleFlags(sg.attrs.get('style'))`); when `rounded`, call the AD-1 helper
  with the four bb corners (absolute, transformed) and the already-resolved
  `filled`/obj fill+pen state, instead of `polygon`. Otherwise unchanged.
- Consequences: rounded clusters emit `<path>` filled with the cluster fill, as
  the oracle does; sharp clusters untouched.

## AD-3: Record/Mrecord — port `record_gencode`'s SPECIAL_CORNERS branch
- Context: `recordGencode` (`src/common/record.ts:473`) always draws a sharp
  polygon for the outer box.
- Decision: mirror C: resolve the node style; force `rounded = true` when the
  node's shape is `Mrecord` (detect via `n.info.shape` name/kind); if
  `SPECIAL_CORNERS(style)` (rounded OR diagonals OR a corner shape) emit the AD-1
  rounded path for the 4 outer-box corners, else keep the polygon. Field divider
  polylines (`genFields`) are unchanged.
- Consequences: Mrecord (and record `style=rounded`) outer box emits `<path>`;
  plain record unchanged.

## AD-4: Rendering-only — geometry is invariant
- Context: rounding changes the boundary stroke shape, not the box extent.
- Decision: do NOT touch sizing/layout. The rounded path is inscribed in the
  SAME bb as the sharp polygon; every node and cluster position, and every bbox,
  must remain byte-identical to pre-mission. Verify in the parity survey: only
  `<polygon>→<path>` element-kind diffs are permitted; zero coordinate deltas on
  unrelated geometry.
- Consequences: bounds the blast radius to rendering; layout fidelity gaps
  (cluster x-balance / keepout / separate — memories `contain-nodes-vstart-window`,
  `2471-blocker-is-cluster-ranking`) are explicitly out of scope.

## AD-5: Reuse `interpolationPoints` + `renderShapeBezier`; match the C constants
- Context: the corner-curve interpolation must byte-match `round_corners`.
- Decision: the AD-1 helper reuses the existing `interpolationPoints(..., true)`
  and bezier emission used by `roundedDraw` (already oracle-aligned for box
  nodes). Do not introduce new curve constants. Verify rounded-box bezier control
  points byte-match the oracle for both a cluster and an Mrecord.
- Consequences: rounded clusters/records inherit the already-correct box-node
  corner curve; no new geometry to validate beyond wiring.

## Rollback
Reversible — revert the commit(s). In-memory render only; no migration.
