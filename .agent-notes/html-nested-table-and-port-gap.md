<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: nested HTML tables + html_port resolution are unported (node d in ports.gv)

- **Context**: chasing the graphs-ports residual after the subgraph rank=same
  fix — 2 edges into node `d` (HTML table with nested `inner` table) diverge.
- **Findings — TWO intertwined gaps:**
  1. **Nested-table layout/emit gap.** `placeCell` (htmltable-pos.ts:237)
     handles only text (`placeCellRuns`) and image (`placeCellImage`) — it has
     NO branch for a cell whose content is a nested `<TABLE>`. Sizing
     (`sizeContentItem`/`sizeTableInner`, htmltable.ts:229) DOES handle nested
     tables, but they are never positioned or emitted. Result: nested-table
     cells render as nothing (val_val) or as stray whitespace text (ports.gv
     node d shows `&#10; &#160;…` instead of RIGHTTOP/RIGHTBOTTOM).
  2. **Parser leaves stray whitespace.** A cell with a nested table parses to
     `content = [text("\n  "), table, text]`. C models a cell as a SINGLE child
     (`cp->child.kind` ∈ HTML_TBL|HTML_IMAGE|HTML_TEXT) and discards whitespace
     around a nested table. @see htmlparse.y cell rule.
  3. **html_port is a STUB.** `htmlPortStub` (compass-port.ts:318) always
     returns null ("T7 dependency"). So named HTML ports (`d:htmlleft`,
     `d:inner:n`, `b:down`, `b:left`, `b:middle`) never resolve — edges fall
     through to a node-bbox compass default. C: `html_port`→`portToTbl`→
     `portToCell` walk the placed table tree for a matching `port` attr,
     returning its box+sides (htmltable.c:876-930).
- **Impact / breadth:**
  - val_val / inv_inv / nul_nul / inv_nul / nul_val / val_nul / inv_val /
    nul_inv / val_inv family (~9 graphs × share/windows/linux mirrors = ~30
    corpus entries) are ALL diverged purely on nested-table LAYOUT (no edges,
    no ports). Fixing layout+emit fixes the family.
  - ports.gv node d additionally needs html_port resolution (gap 3) for its
    edges. Also affects b:down/b:left/b:middle (record ports — those go through
    recordPort, which DOES resolve; only HTML ports are stubbed).
- **Fix shape (two phases):**
  - Phase 1 (self-contained, ~30-entry win): parse-strip whitespace around a
    nested table; add `placeCell` table branch (recursive `posHtmlTable` into
    the cell content box) + a `nested?: PlacedHtml` field; emit recursively in
    `emitHtmlCell`.
  - Phase 2 (completes node d edges): port `portToTbl`/`portToCell` over the
    placed tree; replace `htmlPortStub` in `polyPort`. Box must be stored
    node-relative + reachable from the node's label.
- **Confidence**: High — oracle-confirmed (val_val nested text entirely absent
  in port; node d width 295 vs C 401; htmlPortStub literally returns null).

## RESOLVED (branch fix/html-nested-table-ports)

- **Phase 1** (parse-strip + placeCell nested branch + emit recursion): nested
  tables now lay out + render. val_val family nested text present; ports node d
  4 cells, x[206,396] vs C [206,402]. New `htmltable-port.ts`.
- **Phase 2** (htmlPort: portToTbl/portToCell walking the placed tree; replaced
  htmlPortStub in polyPort; boundary `sidesMask` threaded through pos): node d
  edges resolve — `d:htmlleft` maxΔ 0.4, `d:inner:n` point-count fixed (14),
  maxΔ 13.8. **ports.gv whole-graph maxΔ 556→17.5, 0 structural mismatches.**
- Residual: ports.gv worst is now `C->b:e` (Δ17.5) — a RECORD port on node b,
  unrelated to HTML. Nested-table extra-space distribution (C pos_html_tbl) not
  ported — corpus cases have delx≈0 (single-cell columns) so it's a no-op; add
  if a stretched nested table appears.
