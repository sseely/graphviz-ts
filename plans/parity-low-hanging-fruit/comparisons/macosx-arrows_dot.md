# Deep case: macosx-arrows_dot

- **Corpus path:** `macosx/arrows_dot.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[11]/polygon[1]`
- **Port:** `<polygon points="206.12,-31.84 195.68,-30.06 202.73,-37.96 206.12,-31.84"/>`
- **Oracle:** `<ellipse ...>` (filled circle via C `emit_ellipse`)
- **Root-cause group:** G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>`
- **Why deep:** Identical input graph to linux.x86-arrows_dot and graphs-newarrows; all share the
  same `arrowhead=dot` stub failure. C emits `<ellipse>` via `arrow_type_dot` in arrows.c.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead geometry + ellipse emission infrastructure). Not fixed in this mission.


---

## Arrowhead-geometry mission outcome (2026-06-21)

**Arrow geometry FIXED; residual re-bucketed.** `diverged` → `diverged`. The port now emits the correct arrow primitives — for the dot-engine showcases the arrow primitive *counts* match the oracle exactly (e.g. graphs-arrows: 43 ellipse / 28 polygon / 6 polyline identical). The new first-diff is **`svg/g[1]/g[27]/path[1]/@d`** — an **edge spline `path/@d`** (spline routing / engine layout for circo·twopi), NOT an arrowhead primitive. The arrowhead-geometry gap is closed here; this case now belongs to the spline-routing / engine-layout buckets. Tracked separately.
