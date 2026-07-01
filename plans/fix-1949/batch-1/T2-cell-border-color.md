# T2 — Cell-border color inherits node pen color (D2)

## Context
In corpus 1949, node `structParty` sets `color="red"` and has an HTML-table
label whose cell uses `<TD BORDER="1" SIDES="B">`. Native draws that cell's
bottom border in `red` (inheriting the node pen color); the port draws it
`black`. Locus: `src/common/htmltable-emit.ts:162`
`doBorder({... color: d.color ?? 'black' ...})` hardcodes the fallback.
Native inherits the current pen color when a cell/table border has no
explicit `COLOR`. @see `~/git/graphviz/lib/common/htmltable.c` emit_html_*.

## Task
Replace the literal `'black'` fallback with the node's resolved pen color
threaded through the emit context. Confirm against
`~/git/graphviz/lib/common/htmltable.c` which color native inherits (node
pencolor vs enclosing table color) and mirror it exactly. Do NOT change
borders that carry an explicit `COLOR` attribute. Apply the same fix to the
sibling border emits at lines ~181 and ~324 if they share the fallback.

## Write-set
- `src/common/htmltable-emit.ts`
- `src/common/htmltable-emit.test.ts`

## Read-set
- `src/common/htmltable-emit.ts:155-185, 320-326`
- `~/git/graphviz/lib/common/htmltable.c` (emit_html_cell / emit_html_tbl)
- `.agent-notes/1949-diagnosis.md` (D2 section)

## Acceptance criteria (Given/When/Then)
- Given a node `color=red` with an HTML cell `BORDER="1"` and no cell
  `COLOR`, when emitted, then the cell border stroke is `red`.
- Given a cell with explicit `COLOR="blue"`, when emitted, then the border
  stroke stays `blue` (explicit wins).
- Given a node with no `color` (default), when emitted, then the cell border
  stroke is `black` (unchanged default).
- Given corpus 1949, when rendered, then the `structParty` cell border is
  `stroke="red"` (first-diff `@stroke` resolved).

## Observability
N/A.

## Rollback
Reversible.

## Quality bar
`npx tsc --noEmit` clean; `npx vitest run src/common/` green; tests assert
exact `stroke` values.
