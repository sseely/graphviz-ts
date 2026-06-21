# Deep case: graphs-arrows

- **Corpus path:** `graphs/arrows.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[11]/polygon[1]`
- **Port:** `<polygon fill="black" stroke="black" points="206.12,-31.84 195.68,-30.06 202.73,-37.96 206.12,-31.84"/>`
- **Oracle:** `<ellipse fill="black" stroke="black" cx="198.76" cy="-31.25" rx="4" ry="4"/>`
- **Root-cause group:** G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>`
- **Why deep:** Edge Z->D has `arrowhead=dot`; port emits a 3-point polygon (triangle) while C
  emits a filled circle as `<ellipse>` via `arrow_type_dot`. Porting this arm requires adding
  ellipse-emission support to the arrowhead renderer.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead geometry + ellipse emission infrastructure). Not fixed in this mission.
