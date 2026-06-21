# Deep case: nshare-root_twopi

- **Corpus path:** `nshare/root_twopi.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[3]/polygon[1]`
- **Port:** `<polygon points="9829.26,-259.35 9818.81,-257.57 9825.87,-265.48 9829.26,-259.35"/>`
- **Oracle:** `<ellipse ...>` (filled circle via C `emit_ellipse`)
- **Root-cause group:** G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>`
- **Why deep:** Same as nshare-root_circo (pre-laid-out DOT, dot engine, same `arrowhead=dot` edge);
  `_twopi` suffix is nominal — this is the twopi-pre-laid-out variant of the same root graph.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead geometry + ellipse emission infrastructure). Not fixed in this mission.
