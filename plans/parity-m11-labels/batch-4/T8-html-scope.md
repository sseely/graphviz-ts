# T8 — html-labels mission scoping doc

## Context

graphviz-ts port. Decision D2 (decisions.md) deferred HTML label
support to a future mission; this task writes that mission's
scoping seed. HTML is PARTIALLY live today: poly-gencode.ts imports
emitHtmlLabel from htmltable-emit.js (node main labels). The dead
emit family (deleted in T7) had its own html path (emit-xdot.ts
`if (lp.html) return` + emit.c emit_html_label refs). Hook rule: ≤2
attempts per file.

## Task

Write plans/parity-html-labels/SCOPE.md (new directory) inventorying:

1. WHAT WORKS: trace the live node html-label path end to end
   (parse → makeHtmlLabel/buildNodeLabel → htmltable-pos →
   htmltable-emit → SVG). Cite file:line. Render
   `digraph G { A [label=<<b>hi</b>>]; }` through the port AND
   `dot -Tsvg` and report how close output is.
2. WHAT'S MISSING: html in edge label/xlabel/head/tail, node xlabel,
   graph/cluster label — for each, the creation site that passes
   plain makeLabel today (D2 comments mark them), the C make_label
   aghtmlstr dispatch (utils.c), and the emission-side `lp.html`
   skip sites in the live path (device.ts renderOneEdgeLabel etc.).
3. C SPEC MAP: lib/common/htmltable.c / htmllex.c / htmlparse.y
   surface area already ported vs not (compare src/common/htmltable*
   against the C file list).
4. OPEN DECISIONS for /plan-mission: parser completeness, browser
   text measurement for html cells, golden tolerance class for html
   output.
5. Rough batch sketch (creation dispatch → emission unskip → goldens).

Conclusions with file:line evidence; keep SCOPE.md under 150 lines;
front-load the gap table.

## Write-set

plans/parity-html-labels/SCOPE.md (new). Nothing else.

## Read-set

src/common/poly-init.ts, make-label.ts, htmltable*.ts;
src/gvc/device.ts (lp.html skips); ~/git/graphviz/lib/common/utils.c
label blocks; ~/git/graphviz/lib/common/htmltable.c (overview level)

## Acceptance criteria

- Given SCOPE.md, then it contains the works/missing/spec-map/
  decisions/batch-sketch sections with file:line evidence, ready to
  feed /plan-mission
- Given the live html node-label render comparison, then its result
  (match/divergence) is recorded

## Rollback

Reversible (single commit, doc only). Commit:
`docs(T8): scope html-labels mission`
