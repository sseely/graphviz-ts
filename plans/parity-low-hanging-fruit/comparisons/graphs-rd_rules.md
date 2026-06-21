# Deep case: graphs-rd_rules

- **Corpus path:** `graphs/rd_rules.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[5]/polygon[35]`
- **Port:** `<polygon points="134,-98 134,-182 206,-182 206,-98 134,-98"/>` (5-point rect)
- **Oracle:** `<path d="M146,-98C146,-98 194,-98 194,-98 200,-98 206,-104 206,-110 ..."/>` (rounded bezier path)
- **Root-cause group:** G7 — HTML-table cell layout / rounded border
- **Why deep:** The HTML `<TABLE>` node `tbl1100` uses `style=rounded`; C emits a `<path>` with
  cubic bezier corner arcs for the outer border via `render_corner_arc` (emit.c). Port emits a
  plain 5-point rectangular polygon instead. Porting `render_corner_arc` for HTML table outer
  borders is a non-trivial rendering addition.
- **Follow-on bucket:** `html-table-layout`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs render_corner_arc port for HTML table style=rounded). Not fixed in this mission.
