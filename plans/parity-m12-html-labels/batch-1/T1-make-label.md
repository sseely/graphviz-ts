# T1 — unified make_label entry (AD1)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
~/git/graphviz/lib (tag 15.0.0) is the spec. Vitest, strict TS, JSDoc
@see cites per ported block. Suite baseline 1254/0, 72 goldens. Hook
rule: if a pre-commit/length/CCN hook complains, smallest fix, at most
2 attempts per file, then move on.

The port split C's single `make_label` into `makeLabel`
(src/common/make-label.ts:42, plain text) and `makeHtmlLabel`
(src/common/htmltable-pos.ts:210). C has ONE entry —
`labels.c:make_label(obj, str, kind)` — that branches on
`LT_HTML` internally (labels.c:142,147 set `rv->html = true` and call
`make_html_label`, htmltable.c:1856). The split is the port's
deviation; this task restores the C boundary.

## Task

1. Add the unified entry in make-label.ts mirroring
   `labels.c:make_label`: signature
   `makeAnyLabel(content, isHtml, fontname, fontsize, fontcolor, measurer): TextlabelT`.
   Internally: html → delegate to makeHtmlLabel; plain → existing
   makeLabel path. Port C's html-parse-failure fallback EXACTLY (read
   labels.c make_label + htmltable.c make_html_label error path —
   what does C produce when parseHTML fails? cite it).
2. Switch the node main-label path (buildNodeLabel,
   src/common/poly-init.ts:91 — currently branches on isHtmlValue
   itself) to call the unified entry, removing the call-site branch.
3. TDD: failing tests first in make-label's co-located test file.

## Write-set (strict — nothing else)

src/common/make-label.ts, src/common/poly-init.ts, + their co-located
test files.

## Read-set

~/git/graphviz/lib/common/labels.c:100-160 (make_label);
~/git/graphviz/lib/common/htmltable.c:1840-1900 (make_html_label error
path); src/common/make-label.ts; src/common/htmltable-pos.ts:200-240;
src/common/poly-init.ts:85-110; src/common/html-string.ts (isHtmlValue)

## Architecture decisions

AD1 (this task). The isHtml flag is the C `kind & LT_HTML` equivalent;
callers pass `isHtmlValue(attr)` (the port's aghtmlstr).

## Interface contract (consumed by T4)

`makeAnyLabel(content: string, isHtml: boolean, fontname: string,
fontsize: number, fontcolor: string, measurer: TextMeasurer):
TextlabelT` — html=true with `u: {kind:'html'}` for html input, txt
shape otherwise. Exported from make-label.ts.

## Acceptance criteria

- Given an html string + isHtml=true, when makeAnyLabel, then
  TextlabelT.html=true with PlacedHtml (same object shape the node
  path produces today)
- Given plain text, then result deep-equals today's makeLabel output
- Given the node main-label path switched over, then 72 goldens
  byte-identical and suite 0 failed
- Given C's parse-failure input, then the port's fallback matches
  C's documented behavior (test it; cite labels.c)

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed; byte-stability probe
clean. Commit (orchestrator): `refactor(T1): unify label creation
behind C make_label boundary`
