# Deep case: linux.x86-root_twopi

- **Corpus path:** `linux.x86/root_twopi.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[3]/polygon[1]`
- **Port:** `<polygon points="9825.26,-259.35 9814.81,-257.57 9821.87,-265.48 9825.26,-259.35"/>`
- **Oracle:** `<ellipse ...>` (filled circle via C `emit_ellipse`)
- **Root-cause group:** G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>`
- **Why deep:** Same source as linux.x86-root_circo (pre-laid-out DOT, dot engine);
  same `arrowhead=dot` edge hits the polygon stub. C emits `<ellipse>`.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead geometry + ellipse emission infrastructure). Not fixed in this mission.
