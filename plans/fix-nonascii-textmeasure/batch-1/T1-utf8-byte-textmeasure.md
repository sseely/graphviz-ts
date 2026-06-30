<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — UTF-8-byte iteration in the estimate + LUT measure paths

## Context
graphviz-ts is a faithful TypeScript port; C is the spec. `graphs-japanese` (CJK
labels) diverges because the port measures text per UTF-16 code unit while C
measures per UTF-8 byte (each byte ≥128 → space-width fallback). See
`README.md` (confirmed root cause) and `decisions.md` (AD-1..AD-3).

## Task
Make the port's estimate text measurement iterate the **UTF-8 byte encoding** of
the text, mirroring C's `estimate_text_width_1pt` loop over `(unsigned char)*c`.

1. Add a shared helper that yields the UTF-8 bytes of a string via
   `new TextEncoder().encode(text)` (browser-safe; no Node `Buffer`).
2. Rewrite the per-character loops to iterate those bytes, passing each byte to
   `charWidthUnits` (byte ≥128 → `SPACE_CHAR_CODE`, already handled). Apply to
   **both**:
   - `estimate_text_width_1pt` (`src/common/textmeasure.ts:89`, loop 98–99)
   - `freetypeHintedWidth` (`src/common/textmeasure.ts:128`, loop 138–139) —
     keep its per-unit px-hint-then-sum model, now per byte.
3. ASCII must be unchanged (byte == charCode for <128). Do not alter
   `charWidthUnits`'s ≥128→space mapping (it already matches
   `estimate_character_width_canonical`).

Do not add CJK glyph metrics (AD-1). Do not rewrite the measurer architecture.

## Write-set
- `src/common/textmeasure.ts` — the helper + the two loops
- `src/common/textmeasure.test.ts` — regression tests

## Read-set
- `src/common/textmeasure.ts:71-144` (charWidthUnits, estimate_text_width_1pt,
  freetypeHintedWidth, SPACE_CHAR_CODE)
- C `~/git/graphviz/lib/common/textspan_lut.c:804-846`
  (estimate_character_width_canonical, estimate_text_width_1pt)
- `decisions.md#ad-3` (encoding), `README.md` (confirmed widths)
- Existing `src/common/textmeasure.test.ts` for test patterns

## Architecture decisions in scope
AD-1 (byte-faithful, no CJK metrics), AD-2 (both paths), AD-3 (TextEncoder),
AD-6 (reversible).

## Interface contracts
No type/signature change — `estimate_text_width_1pt` and `freetypeHintedWidth`
keep their signatures; only the internal iteration changes.

## Acceptance criteria
- **Given** a CJK string (e.g. "下駄配列", 4 chars / 12 UTF-8 bytes), **when**
  `estimate_text_width_1pt('Times', s, false, false)` is called, **then** it
  equals 12 × space-width-units / unitsPerEm (the per-byte count), not 4×.
- **Given** an ASCII string, **then** estimate and LUT widths are unchanged from
  the pre-fix values (byte-identical).
- **Given** `~/git/graphviz/tests/graphs/japanese.gv` rendered by the port
  (`GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts
  <input> dot`), **then** all 7 node `rx` values match the oracle within ±0.01.
- **Given** `~/git/graphviz/tests/graphs/Latin1.gv` rendered the same way,
  **then** node widths match the oracle within ±0.01 (confirms the charset→UTF-8
  encoding assumption, AD-3). If they do NOT match, STOP and report — the byte
  source is wrong (C may measure pre-normalization).
- **Given** `npm run typecheck`, **then** exit 0.
- **Given** `npx vitest run src/common`, **then** all measure tests pass (flag
  any pre-existing LUT test that pins a non-ASCII width — AD-2 caveat).

## Observability requirements
N/A — no new observable runtime operations.

## Rollback notes
Reversible — revert the commit. No data/schema/API change.

## Quality bar
Minimal change: one helper + two loop bodies. Return only the diff summary and
the japanese/Latin1 width check (per-node oracle vs port). No preamble.

## Boundaries
- **Always:** keep the change within `textmeasure.ts` + its test; ASCII output
  byte-identical.
- **Ask first / STOP:** if `graphs-Latin1` widths do not match after the fix
  (encoding assumption wrong); if the fix needs a second source file.
- **Never:** add CJK glyph metrics, new config knobs, or measurer rewrites.

## Commit format
`fix(T1): measure text per UTF-8 byte to match C (non-ASCII labels)` with a body
noting the char-vs-byte mechanism and the 23-graph blast radius.
