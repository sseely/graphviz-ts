<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-06-30 | pre-mission | `graphs-japanese` diverged (maxΔ 144, dot). Root cause CONFIRMED by reading both sources: port estimate measurer iterates per UTF-16 code unit (`charWidthUnits`/`estimate_text_width_1pt`/`freetypeHintedWidth`, textmeasure.ts) vs C per UTF-8 byte (`textspan_lut.c:estimate_text_width_1pt`, byte ≥128 → space). CJK 3-byte glyph = 1 space (port) vs 3 (C) → ~1/3 width → nodes collapse to min → 144pt layout shift. Verified: 下駄配列 oracle rx 40.01 (≈12 spaces) vs port rx 27 (min, ≈4 spaces). Blast radius = 23 non-ASCII corpus graphs (9 diverged, 9 structural, 4 conformant=regression-risk, 1 oracle-error). Decisions: fix BOTH paths (AD-2); TextEncoder UTF-8 re-encode (AD-3); survey-gate as checkpoint (no human gate). Encoding caveat: verify against graphs-Latin1, not only UTF-8. |
