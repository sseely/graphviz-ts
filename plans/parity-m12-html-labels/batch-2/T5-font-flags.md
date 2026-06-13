# T5 — font-flag propagation: pos → spans → SVG

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Hook
rule: smallest fix, ≤2 attempts per file, then move on.

The bold-drop bug (SCOPE.md §1 render comparison): C tracks
bold/italic/underline across nested `<B>/<I>/<FONT>` via
`pushFontInfo`/`popFontInfo` (htmltable.c:79). The port parses the
tags (HtmlTextRun.bold/italic exist, htmltable-types.ts:65) but
`buildLineRuns` (htmltable-pos.ts) never transfers the bits into the
emitted TextSpan.fontFlags (emit-types.ts:44 — field exists, dead),
and the SVG `textspan` writer (svg-helpers.ts:~255) emits neither
font-weight/font-style/text-decoration nor fill (span.fontColor is
also dropped). T2 (landed) made measurement variant-aware.

## Task

1. htmltable-pos.ts: port the pushFontInfo/popFontInfo font-env stack
   (htmltable.c:79+) so nested FONT/B/I/U/S resolve to per-run
   effective font state; buildLineRuns sets TextSpan.fontFlags (use
   the C HTML_BF/HTML_IF/HTML_UL/HTML_S flag constants — find/port
   their values from the C headers) and fontColor/fontName/fontSize
   from the resolved env. Pass run flags to measurement (T2's
   parameter) so sizes match C.
2. htmltable-emit.ts: emitHtmlLine passes the span through unchanged
   (verify flags/color survive to the renderer call).
3. svg-helpers.ts textspan: emit font-weight="bold",
   font-style="italic", text-decoration (underline/line-through), and
   fill for fontColor, matching C's svg renderer EXACTLY — read
   ~/git/graphviz/plugin/core/gvrender_core_svg.c (svg_textspan) for
   attribute names, ordering, and the conditions under which each is
   emitted (C omits attributes at defaults; match that or 72-golden
   byte-stability breaks).
4. TDD: failing tests first.

## Write-set (strict — nothing else)

src/common/htmltable-pos.ts, src/common/htmltable-emit.ts,
src/render/svg-helpers.ts, + co-located test files.

## Read-set

~/git/graphviz/lib/common/htmltable.c:60-130 (pushFontInfo/
popFontInfo); ~/git/graphviz/plugin/core/gvrender_core_svg.c
(svg_textspan); ~/git/graphviz/lib/common/textspan.h (flag bits);
src/common/htmltable-pos.ts; src/common/htmltable-emit.ts;
src/render/svg-helpers.ts:250-290; src/common/emit-types.ts:44-75

## Architecture decisions

AD2 (flags to measurement via T2's parameter), AD5 (this task is the
fix the 0.4pt hypothesis rides on — do not loosen anything to make
comparisons pass; T9 judges).

## Interface contract (consumed by T6, T8, T9)

TextSpan instances out of buildLineRuns carry fontFlags + resolved
fontName/fontSize/fontColor; svg textspan renders them. Plain-text
spans (fontFlags=0, fontColor null) render byte-identically to today.

## Acceptance criteria

- Given `<b>hi</b>`, when rendered via the live node path, then
  `<text ... font-weight="bold">` and measured width uses the bold
  variant (x offset shifts toward C's 21.38 — record the new delta
  in your report for T9)
- Given `<font color="red" point-size="20">`, then fill + font-size
  reflect the env; nesting resolves innermost-wins per C
- Given plain-text-only graphs, then 72 goldens byte-identical
- Given `<u>` / `<s>`, then text-decoration matches C's svg output

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed; byte-stability probe
clean. No per-span allocation in the font-env stack (push/pop reuses
a preallocated stack). Commit (orchestrator): `fix(T5): propagate html
font flags through measurement, layout, and svg emission`
