<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions

## AD-1 — Faithful per-UTF-8-byte iteration (not real CJK metrics)
- **Context:** C's estimate maps every byte ≥128 to space width; it has no real
  CJK glyph widths. The divergence is purely char-vs-byte iteration.
- **Decision:** Mirror C — iterate UTF-8 bytes, each byte ≥128 → space-width
  fallback. Do not add a CJK font/glyph metric table.
- **Consequences:** Byte-matches the oracle (which also uses the fallback). More
  accurate CJK rendering is explicitly out of scope (would diverge from C).

## AD-2 — Fix both measure paths
- **Context:** `estimate_text_width_1pt` (estimate/survey path) and
  `freetypeHintedWidth` (LUT path) share the same per-char loop bug.
- **Decision:** Apply byte-iteration to both, via one shared helper, preserving
  each function's own model (estimate sums units then ×fontsize; LUT hints each
  unit to px then sums).
- **Consequences:** Consistent behavior across measurers. LUT path is **not**
  oracle-validated for CJK (goldens use estimate) — its byte-iteration is for
  consistency; flag any LUT unit-test that pins a non-ASCII width.

## AD-3 — Encode via TextEncoder (browser-safe)
- **Context:** The measurer receives a decoded JS string; C measures bytes after
  internal charset→UTF-8 normalization. No Node `Buffer` (must run in browser).
- **Decision:** Re-encode the JS string with `new TextEncoder().encode(...)` and
  iterate the resulting bytes; each byte ≥128 → space index, else the byte value.
- **Consequences:** UTF-8 graphs match directly. Latin-1 graphs match iff C also
  normalizes latin1→UTF-8 before measuring — **verified in T1 against
  `graphs-Latin1`**. If it mismatches, the iteration source is wrong (stop).

## AD-4 — Bar = match oracle widths + 0 regressions
- **Context:** Faithful target is byte-match; the survey gate guards the corpus.
- **Decision:** `graphs-japanese` (7 nodes) and `graphs-Latin1` widths within
  ±0.01 of oracle; `survey:gate` 0 regressions. An irreducible font-metric
  residual → STOP + controlled experiment, not silent accept.
- **Consequences:** Wide blast radius (≤23 graphs) is gated by the survey.

## AD-5 — Reconcile accepted-divergences for status changes
- **Context:** Some non-ASCII graphs may become conformant (remove stale entry)
  or, if any regress, the gate stops the mission.
- **Decision:** For each non-ASCII graph that becomes conformant and has an
  accepted entry, remove it from `accepted-divergences.json` +
  `rules-known-divergences.md` + the hardcoded list in
  `accepted-divergences.test.ts`; keep the guard green.
- **Consequences:** Registry stays honest. Touching the guard test is an expected
  part of reconciliation (it pins ids by hand).

## AD-6 — Reversible
- Revert the commit + restore the baseline. No data/schema/API change.
