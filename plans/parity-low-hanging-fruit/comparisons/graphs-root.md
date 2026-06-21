# Deep case: graphs-root

- **Corpus path:** `graphs/root.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[3]/polygon[1]`
- **Port:** `<polygon points="31134.78,-250.56 31142.87,-243.73 31132.28,-244.02 31134.78,-250.56"/>`
- **Oracle:** `<ellipse ...>` (filled circle via C `emit_ellipse`)
- **Root-cause group:** G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>`
- **Why deep:** Pre-laid-out DOT (contains `pos=` attributes); edge with `arrowhead=dot` still
  hits the polygon stub. C emits a filled `<ellipse>` regardless of whether layout was pre-computed.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead geometry + ellipse emission infrastructure). Not fixed in this mission.
