# Deep case: 144_no_ortho

- **Corpus path:** `144_no_ortho.dot` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[3]/polygon[2]/@points`
- **Port:** `36.8,-47.62 33.3,-37.62 29.8,-47.62 36.8,-47.62` (4 pts)
- **Oracle:** `33.3,-37.56 37.8,-47.56 33.3,-41.34 33.3,-47.56 33.3,-47.56 33.3,-47.56 33.3,-41.34 28.8,-47.56 33.3,-37.56` (9 pts)
- **Root-cause group:** G2 — arrowhead `crow`/`vee` 9-point geometry
- **Why deep:** Edge uses `arrowhead=vee` (`ARR_TYPE_CROW | ARR_MOD_INV`); port's
  `arrowheadPolygon` stub always returns a 3-point triangle regardless of arrowhead type. C's
  `arrow_type_crow0` (arrows.c:632) emits an 8-point (closed: 9-point) polygon — a ~200-line
  geometry port.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead-type dispatch + crow/vee geometry port). Not fixed in this mission.


---

## Arrowhead-geometry mission outcome (2026-06-21)

**IMPROVED — `diverged` → `structural-match`.** The arrow geometry now emits the correct per-type primitives (verified vs the oracle); the residual is sub-tolerance spline/coord drift, not arrow shape. Arrowhead geometry: done.
