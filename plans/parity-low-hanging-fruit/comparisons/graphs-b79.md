# Deep case: graphs-b79

- **Corpus path:** `graphs/b79.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[3]/polygon[1]`
- **Port:** `<polygon points="78.1,-21.5 88.1,-18 78.1,-14.5 78.1,-21.5">`
- **Oracle:** `<ellipse ...>`  (filled circle via C `emit_ellipse`)
- **Root-cause group:** G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>`
- **Why deep:** `arrowhead=dot` must render as a filled ellipse; port falls through to the normal
  triangle polygon stub in `svg-arrowhead.ts`. Porting `arrow_type_dot` from arrows.c and wiring
  `<ellipse>` emission is a multi-module change.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead geometry + ellipse emission infrastructure). Not fixed in this mission.


---

## Arrowhead-geometry mission outcome (2026-06-21)

**IMPROVED — `diverged` → `structural-match`.** The arrow geometry now emits the correct per-type primitives (verified vs the oracle); the residual is sub-tolerance spline/coord drift, not arrow shape. Arrowhead geometry: done.
