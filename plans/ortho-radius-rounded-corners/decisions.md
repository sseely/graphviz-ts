<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions & constraints

## ADRs (approved)

**ADR-1 — Arc emitted as a `<polyline>` of bezier control points, not a `<path>`.**
- Context: `genEllipticPath` builds a *bezier* path, but
  `draw_ortho_corner_markers`→`render_corner_arc`→`gvrender_polyline` emits the
  wedge's control points as straight `<polyline>` vertices (native output is a
  ~25-point polyline, not a curve).
- Decision: replicate exactly — generate the wedge bezier, slice
  `[arc_start_idx=3 .. arc_end_idx=pn-4]`, emit via `svgPolyline`.
- Consequence: conformant requires reproducing `genEllipticPath`'s control points
  precisely (the `dEta`/`alpha` math).

**ADR-2 — Detect ortho+radius at emit time, reading attrs directly (mirrors emit.c).**
- Decision: in `svg.ts endEdge`, read graph `splines==ortho` + edge
  `radius`/`style=rounded` exactly as `emit.c:2554-2581`; no layout-phase
  precompute; default radius = `max(12, penwidth*8)` when `style=rounded` and no
  explicit radius.
- Consequence: change isolated to the emit layer; routing untouched.

**ADR-3 — Two new modules (geometry vs emit), split further if >500 lines.**
- `src/common/ellipse-wedge.ts` (the ellipse.c tessellation) +
  `src/render/svg-edge-ortho-radius.ts` (the emit.c corner logic). Split into
  helper files (e.g. `-corners` / `-arc`) if either approaches the 500-line cap.

**ADR-4 — Faithful only; no radius-specific shortcuts.**
- Port the 8-case `calculate_wedge_parameters`, dedup, and distinct-point skipping
  verbatim, even though the repro only exercises one corner orientation.

## Stop conditions
1. A file outside the declared write-set must change (and is not owned by another
   task) — pause and report.
2. 2 consecutive quality-gate failures on the same check.
3. A stage cannot conformant C and the C oracle cannot be instrumented to explain
   the difference (record as candidate accepted-divergence).
4. Any other corpus graph regresses (match→diverged) with no faithful variant.

## Push forward
- Helper-file splits within a task's write-set.
- Whether a radius graph lands byte vs structural (ADR-4: faithful = success).
- Arc-tessellation rounding details derivable from `genEllipticPath`.
- Journal/test-fixture wording.

## Rollback
Reversible — single `git revert` of the feature commits. No data migration, no
API/contract change. `renderSvg` signature unchanged.
