# T2 — variant-aware text measurement (AD2)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Suite
baseline 1254/0, 72 goldens. Hook rule: smallest fix, ≤2 attempts per
file, then move on.

`TextMeasurer.measure(text, fontname, fontsize)`
(src/common/textmeasure.ts:23) is variant-blind, but the LUT data
already carries bold/italic/boldItalic width arrays
(src/common/textmeasure-lut-data.ts:17-19) with variant selection
inside textmeasure.ts (getVariantWidths, :30, ports
textspan_lut.c:get_metrics_for_font_variant). The html sizing path
(size_html_txt equivalent) measures every run with regular metrics —
this is the root of the 0.4pt x-offset divergence on the live node
html path (bold "hi" measured as regular).

## Task

1. Add an optional flags (or {bold, italic}) parameter to
   `TextMeasurer.measure` and thread it through all three
   implementations in textmeasure.ts: LUT (select variant arrays —
   the selection logic exists), canvas (font shorthand "bold italic
   Npx F"), freetype-hinted (variant per its model). Default =
   regular; existing callers unchanged.
2. In src/common/htmltable.ts, make the size_html_txt-equivalent pass
   each run's bold/italic (HtmlTextRun.bold/italic,
   htmltable-types.ts:65) to the measurer. Cite the C counterpart
   (htmltable.c size_html_txt measuring with the run's font).
3. TDD: failing tests first.

## Write-set (strict — nothing else)

src/common/textmeasure.ts, src/common/htmltable.ts, + co-located test
files.

## Read-set

~/git/graphviz/lib/common/htmltable.c (size_html_txt — grep it);
~/git/graphviz/lib/common/textspan_lut.c:get_metrics_for_font_variant;
src/common/textmeasure.ts; src/common/textmeasure-lut-data.ts:1-30;
src/common/htmltable.ts:240-330; src/common/htmltable-types.ts:55-75

## Architecture decisions

AD2 (this task): flags parameter, NOT fontname mangling.

## Interface contract (consumed by T5, T9)

`measure(text, fontname, fontsize, flags?)` where flags carries
bold/italic; omitted = regular = today's behavior exactly.

## Acceptance criteria

- Given bold "hi" Times 14, when measured, then width > regular "hi"
  width and equals the LUT bold-table value
- Given no flags argument, then results bit-identical to today
  (regression test against current values)
- Given the suite + 72 goldens, then 0 failed / byte-identical (no
  existing caller passes flags yet)

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed; byte-stability probe
clean. No per-call allocations in the measure hot path (reuse, don't
build option objects per span). Commit (orchestrator):
`feat(T2): variant-aware text measurement for html font flags`
