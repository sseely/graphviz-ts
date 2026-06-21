# Triage: polygon-points bucket

Bucket: `firstDiffPath` ends in `@points` — polygon vertex list differs.

## Per-case findings

| id | engine | firstDiffPath | port value (pts) | oracle value (pts) | root cause | verdict | fixModule | fixPlan |
|----|--------|---------------|-------------------|--------------------|------------|---------|-----------|---------|
| 144_no_ortho | dot | svg/g[1]/g[3]/polygon[2]/@points | 4 pts: `36.8,-47.62 33.3,-37.62 29.8,-47.62 36.8,-47.62` | 9 pts: `33.3,-37.56 37.8,-47.56 33.3,-41.34 33.3,-47.56 33.3,-47.56 33.3,-47.56 33.3,-41.34 28.8,-47.56 33.3,-37.56` | **Count mismatch (4 vs 9)**. Edge uses `arrowhead=vee` (`ARR_TYPE_CROW | ARR_MOD_INV`). Port's `arrowheadPolygon` always emits 3-point (→4 in SVG) normal-triangle regardless of arrowhead type. C's `arrow_type_crow0` with INV flag emits 8 distinct points (closed to 9 by gvrender_polygon). | **deep** | `src/layout/dot/edge-route-arrow.ts` | Port `arrow_type_crow0` from `lib/common/arrows.c:632` for `crow` and `vee` shape; wire arrowhead-type dispatch into `arrowheadPolygon` (or a new `arrowheadPoints` that dispatches by parsed arrow name). |
| 144_ortho | dot | svg/g[1]/g[3]/polygon[2]/@points | 4 pts: `32,-47.93 28.5,-37.93 25,-47.93 32,-47.93` | 9 pts: `33.3,-46.93 37.8,-56.93 33.3,-50.71 33.3,-56.93 33.3,-56.93 33.3,-56.93 33.3,-50.71 28.8,-56.93 33.3,-46.93` | **Count mismatch (4 vs 9)**. Same root cause as `144_no_ortho` — `arrowhead=vee` on an edge with `splines=ortho`; same `arrowheadPolygon` stub. `splines=ortho` changes edge routing but not arrowhead shape. | **deep** | `src/layout/dot/edge-route-arrow.ts` | Same fix as `144_no_ortho` (shared root cause; `splines=ortho` makes no difference to the arrowhead geometry code path). |
| 2490 | dot | svg/g[1]/g[3]/polygon[1]/@points | 4 pts: `23.5,-60.49 27,-70.49 30.5,-60.49 23.5,-60.49` | 9 pts: `27,-61.67 22.5,-71.67 27,-67 27,-71.33 27,-71.33 27,-71.33 27,-67 31.5,-71.67 27,-61.67` | **Count mismatch (4 vs 9)**. Edge uses `arrowhead=crow arrowtail=crow` (`ARR_TYPE_CROW` without INV). C's `arrow_type_crow0` without INV flag also emits 8 pts → closed to 9. Same `arrowheadPolygon` stub failure. | **deep** | `src/layout/dot/edge-route-arrow.ts` | Same fix as above; `crow` (non-INV) branch of `arrow_type_crow0` must also be ported alongside `vee`. |

## Summary

**Simple: 0. Deep: 3.**

All three cases share a single root cause: `arrowheadPolygon` in
`src/layout/dot/edge-route-arrow.ts` is a stub that always returns the 3-point
"normal" (triangle) arrowhead, ignoring the actual `arrowhead=` / `arrowtail=`
attribute. C's `arrow_type_crow0` (`lib/common/arrows.c:632`) produces an 8-point
(closed: 9-point) polygon for both `crow` (`ARR_TYPE_CROW`) and `vee`
(`ARR_TYPE_CROW | ARR_MOD_INV`) arrow types.

**Shared root-cause group (all 3):** `arrowheadPolygon` must be replaced with a
dispatch function that reads the edge's `arrowhead`/`arrowtail` attribute, parses
it via `parseArrow`, and routes to the correct geometry builder —
`arrow_type_crow0` for crow/vee, keeping the current normal-triangle logic for
`normal`/`inv`. This is a non-trivial geometry port (~200 lines of C), making all
three cases **deep**.

### Notes on `inv` arrowhead (present in 144 cases as `arrowtail=inv`)
The `inv` type (`ARR_TYPE_NORM | ARR_MOD_INV`) correctly renders as a 4-point
triangle in both oracle and port (e.g., `polygon[1]` in 144 cases), so the
normal/inv normal arrowhead is already correct. Only crow/vee are broken.
