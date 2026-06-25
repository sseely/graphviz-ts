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
B0 rules survey: <N> byte-exact / <M> allowlisted pre-existing / <K> FAIL
B1 browser-bundle canvas-free: pass/fail
B2 measurement unit tests: <counts>
B3 full-corpus rules cutover: <N> exact / <M> allowlisted
```

## Batch 0 — execution log
| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-24 | T0.1 | EstimateTextMeasurer h=fontsize*1.20 (LINESPACING), w=raw estimate | spike-proven byte-match to headless dot; const.h:70 LINESPACING=1.20 |
| 2026-06-24 | T0.2 | Rules gate = per-graph no-regression vs pango baseline, not absolute byte-match | full-SVG compareSvg conflates node geometry with edge/text emit; the signal is "no graph gets worse" |
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
