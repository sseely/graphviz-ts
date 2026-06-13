# T6 — cell decoration emission (fills, sides, rules, HR/VR, anchors)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Hook
rule: smallest fix, ≤2 attempts per file, then move on.

htmltable-emit.ts emits only cell borders (emitHtmlBox) and text runs
(emitHtmlLine). Unported C emission surface (SCOPE.md §3): setFill
BGCOLOR/STYLE fill (htmltable.c:348), initAnchor/endAnchor URL
anchors (:381, :432), per-side borders (SIDES), table RULES /
CELLBORDER lines, and `<HR>`/`<VR>` rules. T3 (landed) parses SIDES/
GRADIENTANGLE; T5 (landed) gives spans full font state. The SVG
renderer already implements beginAnchor/endAnchor (src/render/
svg.ts:79-89) — use the RendererPlugin interface, do not hand-roll
`<a>` tags.

## Task

Port into htmltable-emit.ts, following C's emit_html_tbl /
emit_html_cell structure and order:

1. setFill (htmltable.c:348): SOLID BGCOLOR rect behind table/cell.
   Two-color/gradient BGCOLOR + GRADIENTANGLE: per AD4, data is
   stored but paint is DEFERRED — emit the solid fallback only if C
   does so, else skip with a comment citing AD4; verify what C
   actually draws when gradients are unavailable (read setFill).
2. Per-side borders per SIDES bitmask; table RULES/CELLBORDER lines;
   `<HR>`/`<VR>` rules — each matching the C drawing calls (boxes vs
   polylines, pen widths).
3. Anchors: initAnchor/endAnchor (:381/:432) → RendererPlugin
   beginAnchor/endAnchor around the cell/table content, with the same
   href/tooltip/target resolution C does.
4. TDD: failing tests first (string-level SVG assertions per case).

## Write-set (strict — nothing else)

src/common/htmltable-emit.ts + its co-located test file.

## Read-set

~/git/graphviz/lib/common/htmltable.c:330-460 (setFill, initAnchor,
endAnchor), emit_html_tbl/emit_html_cell (grep);
src/common/htmltable-emit.ts; src/common/htmltable-types.ts (T3's new
fields); src/render/svg.ts:75-95 (beginAnchor signature); C oracle:
`echo '...' | dot -Tsvg` for each decoration case.

## Architecture decisions

AD4 (solid fill in scope; gradient paint deferred — journal if C's
no-gradient fallback is ambiguous), AD-C1.

## Interface contract (consumed by T9, T10)

None new — terminal emission. SVG output for decorated tables matches
C structurally (element kinds, nesting, order).

## Acceptance criteria

- Given `<TD BGCOLOR="lightblue">`, then a filled rect behind the
  cell, structurally matching C's SVG (element order + attributes)
- Given `<TABLE SIDES="LT">`, then only left+top border lines
- Given `<TD HREF="http://x">`, then the cell content is wrapped in
  the anchor exactly where C wraps it
- Given `<HR>`/`<VR>`, then rule lines at C's coordinates
- Given undecoated html tables, then output unchanged from post-T5

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed; byte-stability probe
clean. Commit (orchestrator): `feat(T6): emit html cell decorations
(fills, sides, rules, anchors)`
