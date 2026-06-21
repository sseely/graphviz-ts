# Deep case: nshare-root_circo

- **Corpus path:** `nshare/root_circo.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[3]/polygon[1]`
- **Port:** `<polygon points="9829.26,-259.35 9818.81,-257.57 9825.87,-265.48 9829.26,-259.35"/>`
- **Oracle:** `<ellipse ...>` (filled circle via C `emit_ellipse`)
- **Root-cause group:** G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>`
- **Why deep:** Pre-laid-out DOT (dot engine, despite `_circo` suffix); `arrowhead=dot` edge hits
  the polygon stub. Slightly different x-coordinates from a different pre-layout run vs
  linux.x86-root_circo, but same root cause.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead geometry + ellipse emission infrastructure). Not fixed in this mission.
