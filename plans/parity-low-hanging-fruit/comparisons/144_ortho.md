# Deep case: 144_ortho

- **Corpus path:** `144_ortho.dot` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[3]/polygon[2]/@points`
- **Port:** `32,-47.93 28.5,-37.93 25,-47.93 32,-47.93` (4 pts)
- **Oracle:** `33.3,-46.93 37.8,-56.93 33.3,-50.71 33.3,-56.93 33.3,-56.93 33.3,-56.93 33.3,-50.71 28.8,-56.93 33.3,-46.93` (9 pts)
- **Root-cause group:** G2 — arrowhead `crow`/`vee` 9-point geometry
- **Why deep:** Same as 144_no_ortho (`arrowhead=vee`, same stub failure); `splines=ortho` changes
  edge routing but not arrowhead geometry. C's `arrow_type_crow0` (arrows.c:632) emits 9 points;
  port always returns a 3-point triangle.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead-type dispatch + crow/vee geometry port). Not fixed in this mission.


---

## Arrowhead-geometry mission outcome (2026-06-21)

**IMPROVED — `diverged` → `structural-match`.** The arrow geometry now emits the correct per-type primitives (verified vs the oracle); the residual is sub-tolerance spline/coord drift, not arrow shape. Arrowhead geometry: done.
