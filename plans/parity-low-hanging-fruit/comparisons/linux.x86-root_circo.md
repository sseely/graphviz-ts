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
