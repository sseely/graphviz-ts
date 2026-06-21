# Deep case: linux.x86-arrows_dot

- **Corpus path:** `linux.x86/arrows_dot.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[11]/polygon[1]`
- **Port:** `<polygon points="206.12,-31.84 195.68,-30.06 202.73,-37.96 206.12,-31.84"/>`
- **Oracle:** `<ellipse ...>` (filled circle via C `emit_ellipse`)
- **Root-cause group:** G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>`
- **Why deep:** Identical input graph to graphs-newarrows; `arrowhead=dot` on edge Z->D emits a
  triangle polygon stub instead of the correct filled `<ellipse>` from C's `arrow_type_dot`.
- **Follow-on bucket:** `arrowhead-geometry`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs arrowhead geometry + ellipse emission infrastructure). Not fixed in this mission.
