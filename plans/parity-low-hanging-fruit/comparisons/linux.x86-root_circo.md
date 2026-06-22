# Deep case: linux.x86-root_circo

- **Corpus path:** `linux.x86/root_circo.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[3]/polygon[1]`
- **Port:** `<polygon points="9825.26,-259.35 9814.81,-257.57 9821.87,-265.48 9825.26,-259.35"/>`
- **Oracle:** `<ellipse ...>` (filled circle via C `emit_ellipse`)
- **Root-cause group:** G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>`
- **Why deep:** Pre-laid-out DOT with `pos=` attributes (despite the `_circo` filename, the corpus
  manifest assigns this to the `dot` engine). `arrowhead=dot` on the edge hits the polygon stub;
  C emits `<ellipse>` via `arrow_type_dot`.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead geometry + ellipse emission infrastructure). Not fixed in this mission.


---

## Arrowhead-geometry mission outcome (2026-06-21)

**Arrow geometry FIXED; residual re-bucketed.** `diverged` → `diverged`. The port now emits the correct arrow primitives — for the dot-engine showcases the arrow primitive *counts* match the oracle exactly (e.g. graphs-arrows: 43 ellipse / 28 polygon / 6 polyline identical). The new first-diff is **`svg/g[1]/g[5]/path[1]/@d`** — an **edge spline `path/@d`** (spline routing / engine layout for circo·twopi), NOT an arrowhead primitive. The arrowhead-geometry gap is closed here; this case now belongs to the spline-routing / engine-layout buckets. Tracked separately.
