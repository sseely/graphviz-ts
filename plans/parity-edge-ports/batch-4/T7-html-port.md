# T7 — html_port + portToTbl (AD5) [GATED]

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82 goldens.
Hook rule: smallest fix, ≤2 attempts per file, then move on.
Hook limits: 30 lines/fn, CCN 10, 5 params, 500 lines/file.

**GATE CHECK (run before starting T7):** Verify that
`src/common/htmltable.ts` exports a `portToTbl` function (ported in
the html-labels mission). If it does NOT exist, SKIP T7 and proceed
directly to T8. Note the skip in the decision journal.

Batches 1–3 and T6 are done. Port-based spline attachment works for
polygon and record shapes. The remaining surface is HTML-cell ports:
`poly_port` has a branch (`ND_label(n)->html && html_port(...)`) that
finds the cell by its `PORT` attribute, gets the cell's bbox, and
delegates to `compassPort`. M12 stored `PORT` but did not port
`html_port` or `portToTbl` (declared exception AD6 of that mission).

## Task

1. Port `portToTbl(tp, id)` in `src/common/htmltable.ts` (or a
   separate `src/common/htmltable-port.ts` if the 500-line limit is
   already hit):
   - Recurses the `HtmlTblT` cell tree matching `cell.data.port === id`
   - Returns the matching `HtmlDataT` or null
   @see `lib/common/htmltable.c:873-915`.

2. Port `html_port(n, pname, sidesOut)` in the same file:
   - Gets the HTML label from `ND_label(n)`
   - If label is plain text (not a table), returns null
   - Calls `portToTbl(lbl.u.tbl, pname)`; if found, sets `*sidesOut`
     and returns `&tp->box`
   @see `lib/common/htmltable.c:916-933`.

3. Update `src/common/compass-port.ts` (`poly_port`) to replace the
   stub null-return for the HTML branch with a real call to `htmlPort`:
   ```ts
   const bp = htmlPort(n, portname, sidesRef);
   if (bp != null) { ... }
   ```
   (T3 left a stub here — now make it real.)

4. TDD tests in `src/common/htmltable-port.test.ts`:
   - `portToTbl` finds a cell by PORT attr; returns null when absent
   - `html_port` on a plain-text label returns null
   - `html_port` on a table with a matching PORT cell returns that
     cell's bbox and sets `sides`
   - Integration: render an HTML-label node with a cell `PORT="p1"` and
     an edge `tailport="p1"`; verify the edge exits from the cell
     bbox center

## Write-set (strict — nothing else)

- `src/common/htmltable.ts` OR `src/common/htmltable-port.ts` (one
  file for portToTbl + html_port)
- `src/common/htmltable-port.test.ts` (new)
- `src/common/compass-port.ts` (replace HTML-branch stub in poly_port)

## Read-set

- `~/git/graphviz/lib/common/htmltable.c:873-935` — portToTbl +
  html_port (full)
- `src/common/htmltable.ts` — existing cell tree structure; confirm
  HtmlDataT.port field is present (M12 T3 stored PORT)
- `src/common/compass-port.ts` — poly_port HTML branch stub (T3)
- `src/model/geom.ts:85-100` — Port fields (bp is Box | null)

## Architecture decisions (locked)

AD1 (bp is value copy of cell bbox), AD5 (html port in this mission,
gated), AD-C1.

## Acceptance criteria (only if T7 runs)

- Given an HTML table node with `<TD PORT="p1">` and an edge
  `tailport="p1"`, when layout runs, then `e.info.tail_port.defined
  === true` and `e.info.tail_port.p` is within the cell's bbox
- `portToTbl` with a non-existent port returns null
- tsc clean; 0 vitest failed; 82 + new port goldens pass

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` 0 failed, ≥1466 passed.
Commit: `feat(T7): port portToTbl + html_port; wire poly_port HTML
branch`.
