<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: fix non-ASCII text measurement (graphs-japanese)

## Objective

`graphs-japanese` is `diverged` (maxΔ 144, dot engine): CJK node labels render
far too narrow (e.g. 下駄配列 oracle rx 40.01 vs port rx 27 = min-width). Root
cause is **confirmed**: the port's estimate text measurer iterates text **per
UTF-16 code unit** while C iterates **per UTF-8 byte**, mapping each byte ≥128 to
the space-width fallback. A 3-byte CJK glyph therefore measures as 1 space in the
port vs 3 in C (~1/3 width); Latin-1/Cyrillic (2-byte) measure ~1/2. Under-sized
nodes shift the layout → the 144pt edge-path delta. Fix: iterate the UTF-8 byte
encoding in both measure paths, mirroring C exactly. Restore `graphs-japanese`
to **conformant** (node widths ±0.01) with **zero net parity regressions**.

## Confirmed root cause (pre-mission)

- Port `src/common/textmeasure.ts`: `charWidthUnits` (line 76) takes
  `text.charCodeAt(i)` (UTF-16 unit); `estimate_text_width_1pt` (98–99) and
  `freetypeHintedWidth` (138–139) loop `for i < text.length`.
- C `lib/common/textspan_lut.c`: `estimate_text_width_1pt` (833) loops
  `for (const char *c = text; *c; c++)` — **per byte**, `(unsigned char)*c`;
  `estimate_character_width_canonical` (804) maps `character >= 128` → `' '`.
- Verified: 下駄配列 = 4 chars / 12 UTF-8 bytes; oracle rx 40.01 ≈ 12 spaces,
  port rx 27 (min) ≈ 4 spaces. New_JIS_getas wider only via Latin "JIS".

## Blast radius

Estimate text measurement → only graphs with **non-ASCII labels** change
(ASCII byte == charCode, unchanged). **23 applicable corpus graphs** have
non-ASCII bytes: 9 diverged (likely improve, incl. `graphs-japanese`,
`graphs-cairo`), 9 structural-match, **4 conformant (regression risk:
`1724`, `2343`, `2502`, `graphs-b993`)**, 1 oracle-error (`2621`). The survey
gate is the guard.

**Encoding caveat:** C measures bytes *after* its internal charset→UTF-8
normalization, so the faithful fix re-encodes the decoded JS string to UTF-8 and
counts bytes. This must be verified against a **Latin-1** graph (`graphs-Latin1`),
not only UTF-8/CJK — a wrong encoding assumption surfaces there.

## Branch

`fix/nonascii-textmeasure` (merge commit on completion — preserves per-task
commit IDs).

## Constraints

**Faithful port.** C is the spec. Mirror C's per-byte / space-fallback model
exactly; do NOT add real CJK glyph metrics (C does not have them).

### Stop conditions
- `survey:gate` shows ANY regression (esp. the 4 conformant non-ASCII cases) —
  STOP, do not refresh the baseline to mask it.
- The fix needs editing a file outside the declared write-set.
- A non-ASCII residual traces to an irreducible font-metric/FMA tie-break —
  STOP and report with a controlled experiment; do not silently accept.
- 2 consecutive quality-gate failures on the same check; or the same line
  changed 3× without resolving the same failure.

### Push-forward conditions
- Helper naming, test phrasing, which non-ASCII graphs to spot-check, journal
  wording. Stylistic choices with no behavioral effect.

## Quality gates

| command | pass | on_fail |
|---|---|---|
| `npm run typecheck` | exit 0 | fix_and_rerun |
| `npx vitest run src/common` | exit 0 | fix_and_rerun |
| `graphs-japanese` re-rendered | all 7 node widths match oracle ±0.01 | stop |
| `graphs-Latin1` re-rendered | node widths match oracle ±0.01 (encoding check) | stop |
| `npm run survey && npm run survey:gate` | exit 0 (0 regressions) | stop |
| `git diff --name-only` | matches declared write-set only | stop |

Baseline refresh recipe (Batch 2, T2): `GV_TEXT_MEASURER=estimate
GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts` →
`npx tsx test/corpus/rules-gate.ts` (0 regressions) →
`cp test/corpus/parity-rules.json test/corpus/parity.json` →
`npx tsx test/corpus/dashboard.ts` (regenerates `PARITY.md`). If a non-ASCII
case changes accepted status, reconcile `accepted-divergences.json` +
`rules-known-divergences.md` (and the hardcoded rules-allowlist in
`accepted-divergences.test.ts` — it pins ids by hand).

## Batches

| Batch | Status | Tasks |
|---|---|---|
| [Batch 1 — Fix](batch-1/overview.md) | [x] | T1 |
| [Batch 2 — Verify (survey-gated)](batch-2/overview.md) | [ ] | T2 |

## Index

- [decisions.md](decisions.md) — architecture decisions
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-utf8-byte-textmeasure.md)
- [batch-2/overview.md](batch-2/overview.md) · [T2](batch-2/T2-survey-gate-baseline.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Precedent: `plans/fix-root-twopi/` (same fix+survey-gate shape); memories
  `textmeasure-cutover-done`, `parity-text-charset-cluster-done`.
