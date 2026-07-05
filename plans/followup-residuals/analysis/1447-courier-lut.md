<!-- SPDX-License-Identifier: EPL-2.0 -->
# F3 — 1447 (diagnosed 2026-07-05) — NOT ortho: truncated Courier width LUT — FIX (validated conformant)

mechanism: CW Courier glyph-width array (src/common/textmeasure-lut-data-a.ts
:108-117) transcribed with 124 entries instead of 128 — indices 123-126
({ | } ~) missing, terminal -1 sits at 123. charWidthUnits' `widths[code]
?? -1` (textmeasure.ts:77-80) silently maps those 4 chars to width 0 where C
(textspan_lut.c:165-230) has 1229/2048 em. 1447's single labeled node
contains one `|` → node 8.4014pt too narrow (385.66 vs 394.06) → network
simplex packs ranks tighter → 32/36 glyphs shift x by 4-42pt → ortho maze
built from shifted boxes → 53/56 routes differ incl. 2 point-count
mismatches and maxΔ192.39. "Fourth ortho mechanism" hypothesis REFUTED —
defect is upstream of position AND ortho. Same truncation in Consolas
CR/CBI (1126 units); minor third: Nunito italic aliased to regular (C
differs at [77]=856 [78]=739 [86]=688).

ruledOut: ortho internals (never reached — divergence precedes routing;
consistent with R4/R9 fixes leaving 1447 byte-untouched); label-string
processing (identical 45-char ASCII both sides, hexdumped); font-family
resolution (all other chars measure 1229/2048 exactly); estimate algorithm
(full 44-array audit vs direct textspan_lut.c parse — no other mismatch).

verdict: FIX — data-only, at origin. Worktree-validated: 1447 719 diffs →
pass=true 0 diffs; 16/16 splines=ortho corpus files byte-identical pre/post
(git-stash A/B); vitest 2683 green. Corpus exposure: only 1447 combines a
Courier/Consolas fontname with {|}~ in label text.

proposedWriteSet (→ F4 fix task):
- textmeasure-lut-data-a.ts: CW indices 123-126 = 1229, 127 = -1 (128
  total); Nunito italic → faithful NI array; fix stale comment.
- textmeasure-lut-data-b.ts: CR + CBI append 4× 1126 + terminal -1.
- test: assert every ALL_FONT_METRICS array has length 128 (class guard) +
  estimate_text_width_1pt('Courier','{|}~') = 4×1229/2048.
- Note only: C's one-shot agwarningf for -1 widths unported (silent vs
  warn) — not needed for parity.

C-cleanup: no C instrumentation performed; lib/ortho untouched; sibling
(F1/F2) instrumentation in lib/dotgen left intact; oracle render
byte-stable vs cache.
