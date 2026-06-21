# Deep case: nshare-arrows_dot

- **Corpus path:** `nshare/arrows_dot.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[11]/polygon[1]`
- **Port:** `<polygon points="206.12,-31.84 195.68,-30.06 202.73,-37.96 206.12,-31.84"/>`
- **Oracle:** `<ellipse ...>` (filled circle via C `emit_ellipse`)
- **Root-cause group:** G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>`
- **Why deep:** Same graph as linux.x86-arrows_dot; `arrowhead=dot` edge Z->D hits the polygon stub.
  All platform variants (linux.x86, macosx, nshare) share the same root cause.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead geometry + ellipse emission infrastructure). Not fixed in this mission.
