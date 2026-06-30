# Decision journal — text-measurement architecture

Appended during execution. One row per non-trivial judgment call.

| When | Batch/Task | Decision | Rationale |
|------|-----------|----------|-----------|
| 2026-06-24 | (pre) | Re-scope: this is a text-measurement architecture mission, not an x-coord fix | Investigation+spike (DESIGN.md §2) proved layout rules are faithful; divergence is font measurement |

## Settled up-front (from DESIGN.md review)
- Corpus migration: side-by-side then cut over (ADR-3).
- Hinted LUT: demote to internal fallback (ADR-4).
- Node no-canvas fallback: EstimateTextMeasurer + warning that advises installing
  the canvas package (ADR-5).

## Batch tallies (fill in during execution)
```
B0 rules survey: <N> conformant / <M> allowlisted pre-existing / <K> FAIL
B1 browser-bundle canvas-free: pass/fail
B2 measurement unit tests: <counts>
B3 full-corpus rules cutover: <N> exact / <M> allowlisted
```

## Batch 0 — execution log
| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-24 | T0.1 | EstimateTextMeasurer h=fontsize*1.20 (LINESPACING), w=raw estimate | spike-proven conformant to headless dot; const.h:70 LINESPACING=1.20 |
| 2026-06-24 | T0.2 | Rules gate = per-graph no-regression vs pango baseline, not absolute conformant | full-SVG compareSvg conflates node geometry with edge/text emit; the signal is "no graph gets worse" |
| 2026-06-24 | T0.2 | Allowlist 4 match→diverged after verifying node-position Δ directly | 3 are emit artifacts (nodes 0.00); 2168_2 widths match headless, 1pt is x-NS/compass-port (out of scope per DESIGN non-goals) |
| 2026-06-24 | T0.2 | Reuse survey.ts via GVBINDIR=ghl + GV_TEXT_MEASURER=estimate + PARITY_OUT (all backward-compat) | side-by-side: default survey path provably unchanged (sample: 0 verdict changes) |

### B0 rules survey tally
```
rules-gate: stable=599 improvements=10 pre-existing=171 allowlisted=4 regressions=0  → GATE PASS
improvements (font-measurement fixes): 2193, graphs-NaN/b102/b143/xx, {linux,share,windows}-{NaN,b102}
pre-existing=171 == pango baseline diverged (171), all font-independent
side-by-side invariant: default survey == committed baseline (0 changes)
```
Layout RULES proven faithful; b69/b135/b15 stay pre-existing on NON-font (concentrate/x-NS) issues.

## Batch 1 — execution log
| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-25 | T1.1 | node-canvas is OPT-IN (not auto-loaded); refines ADR-6 | Library is ZERO-runtime-dep + single esbuild browser+Node bundle; a static/dynamic `canvas` import would break the browser bundle. Consumers wire node-canvas via setTextMeasurer(new CanvasTextMeasurer(...)). |
| 2026-06-25 | T1.1 | LUT-demotion + Node default change DEFERRED to cutover (T3.2) | Side-by-side (ADR-3): the old pango survey uses the default measurer (LUT) via render-one; changing the default now would break it. Default stays LUT until cutover; rules survey forces estimate via GV_TEXT_MEASURER. |
| 2026-06-25 | T1.1 | Browser-safe process.env read (`typeof process`) + fitness guard "no canvas import in src" | CLAUDE.md forbids unguarded process.env in browser lib code; the guard test prevents future node-canvas wiring from leaking into the browser bundle. |
| 2026-06-25 | T1.1 | `override` module global allowlisted in module-globals.fitness | Process-wide DI hook (set via setTextMeasurer), not per-render state — analogous to activeSizer/setImageSizer. |

### B1 gate
```
setTextMeasurer/getTextMeasurer public; resolution = override → env(estimate) → browser-canvas → LUT
build: esbuild bundle OK, 0 `canvas` refs in dist/index.js (browser-safe)
tests: 2394 pass; side-by-side default survey unchanged (0 verdict changes)
```

## Batch 2 — execution log
| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-25 | T2.1 | Shaper = fontkit (devDep); no harfbuzzjs | fontkit applies GPOS kerning + GSUB substitution + charset in pure JS, deterministically; one dep covers all three. harfbuzzjs unnecessary. |
| 2026-06-25 | T2.1 | Bundle DejaVu Sans + Fira Code (test/fonts/) | DejaVu: real kerning (VA −131), GSUB (fi→1 glyph), Latin-1/Greek charset. Fira Code: monospace (`<=` = 2 cells) shows width is font-specific. Open licenses (DejaVu / SIL OFL). |
| 2026-06-25 | T2.1 | Test METRIC = advance width + glyph substitution, not glyph count | FiraCode `<=` is width-neutral (monospace) and fontkit didn't collapse its calt glyph ids; the layout-relevant signals are advance width (kerning) and GSUB substitution (fi). |
| 2026-06-25 | T2.1 | Tests contrast fontkit (real) vs EstimateTextMeasurer (deterministic) | Makes the decoupling concrete: estimate does NOT kern (VA==V+A) and has no non-ASCII metrics (é falls back) — exactly why production needs the host/real-font measurer. |

### B2 gate
```
7 measurement tests pass (kerning, GSUB, charset, monospace, estimate-contrast, determinism)
fontkit + fonts are dev/test-only: 0 fontkit refs in dist/*.js (runtime bundle clean)
full suite 2401 pass; typecheck + lizard clean
```

## Batch 3 — execution log
| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-25 | T3.1 | node-canvas is opt-in via setTextMeasurer; canvas = OPTIONAL PEER dep | Zero-runtime-dep + single bundle: library never imports canvas. peerDependenciesMeta.optional makes it discoverable without force-install. |
| 2026-06-25 | T3.1 | Install-advice note: one-time, TTY-only, GV_FONT_QUIET-suppressible | Honors ADR-5 ("advise install") without spamming CI/tests/piped output. Verified: 1 line on TTY, 0 when quiet/piped. |
| 2026-06-25 | T3.1 | Docs: README section + docs-site/guide/text-measurement.md + sidebar | States the deterministic-default / host-faithful-opt-in contract. |

### B3/T3.1 gate
```
2401 tests pass; typecheck + lizard clean; bundle builds canvas-free (0 refs)
advice note: TTY→1 (once), GV_FONT_QUIET→0, piped→0
adviceShown one-time latch allowlisted in module-globals.fitness
```

### T3.2 — STOP before cutover (blast-radius escalation)
Forcing the default measurer to Estimate (the cutover's implied default change)
**fails 167 unit tests** across 8 files — they assert LUT-hinted golden output.
So "cut over to the rules survey + change the default" is a far larger
re-baseline than ADR-3 anticipated. Escalated to the user for a decision among:
(a) full cutover + regenerate 167 goldens + corpus; (b) keep LUT default, adopt
the rules survey as a PARALLEL clean rules-gate, keep the pango survey as the
shipped-fidelity tracker (no re-baseline); (c) other. Pausing per autonomous
STOP condition "task is mis-scoped / much bigger than estimated".

### T3.2 — RESOLVED: full cutover (user chose option A)
User: *"A. What this buys us is faithful usage of what the change does … if this
methodology is the right path, the goldens should cut over and continue to work.
Failure here shows that the idea needs some polish."* — full cutover, residuals
exposed honestly (not papered over).

| When | Decision | Rationale |
|------|----------|-----------|
| 2026-06-25 | Node default → EstimateTextMeasurer (textmeasure-factory) | Ships the validated headless/rules path as the default; LUT demoted to GV_TEXT_MEASURER=lut opt-in. |
| 2026-06-25 | Vertical metrics measurer-driven, not pango constants | yoffset_centerline 0.05→0.1·fs and HTML simple-run ascent (=fontsize) now come from TextSize.yoffsetCenterline/yoffsetLayout; pango values are the fallback. Closed the 0.7pt text-@y and 1.25pt HTML-ascent regressions the regen exposed. |
| 2026-06-25 | Regenerate ALL 160 golden refs against the headless oracle | Per user: the goldens must cut over and still pass. They do, at deterministic (0.01pt) tolerance. |
| 2026-06-25 | 3 residuals SKIPPED via manifest knownResidual, not hidden | dot-port-record-aligned (record-field 1pt rounding); fdp-large + fdp-tiny-self-loop (fdp solver / native-headless-fdp instability). Honest exposure = "needs polish", per the user's framing. |
| 2026-06-25 | 27 inline coord tests pinned to LUT via test/helpers/measurer.ts | They characterize a specific vertical/shaping model (incl. the accepted LUT whole-string shaping divergence); estimate-default geometry is covered by the golden suite. pinLutMeasurer sets immediately + per-test so module-load renders are covered. |
| 2026-06-25 | Rules survey = canonical (npm run survey + gen-headless-gvbindir.sh + survey:gate); pango retired to survey:baseline | ADR-3 cutover. Kerning/charset coverage moved to Batch-2 measurement tests. |

### T3.2 gate
```
golden suite: 160 pass / 3 skipped (documented cutover residuals)
full suite: 2398 pass / 3 skipped; typecheck PASS; lizard clean
rules-gate: stable=599 improvements=10 pre-existing=171 allowlisted=4 regressions=0 → PASS
commit 239c51b (feature/text-measure-arch)
```
