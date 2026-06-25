# Mission: text-measurement architecture (decouple layout rules from font metrics)

**Status:** Batch 0 + 1 DONE. B0 rules gate PASS (599 stable, 10 font-fix
improvements, 0 regressions). B1: public `setTextMeasurer` + resolution chain,
browser-bundle canvas-free, side-by-side held. Branch: `feature/text-measure-arch`.
Now: Batch 2.

## Objective
Implement the design in [DESIGN.md](DESIGN.md): split text measurement into three
swappable roles behind the existing `TextMeasurer` seam, so layout **rules** are
validated deterministically against headless graphviz while font **metrics**
(hinting / kerning / shaping) become a separate, swappable, separately-tested
layer. This resolves the b69/b135/b15 x-coord divergences (proven to be
font-measurement, not layout-rules) and makes production output measure with the
host font the renderer actually uses.

The investigation + spike that justify this are in DESIGN.md §2 and the
conversation decision log; the minimal repro is `repro/b69-min-noconc.gv`.

## Settled decisions (see decisions.md for ADRs)
- **ADR-1** Reference measurer = raw `estimate_text_width_1pt` (no hint/kern,
  h=`fontsize*1.20`) — byte-matches headless dot. Spike-proven.
- **ADR-2** Decouple: rules corpus uses the reference measurer vs **headless**
  goldens; kerning/shaping/charset move to targeted bundled-font tests.
- **ADR-3** Corpus migration is **side-by-side, then cut over** (not big-bang).
- **ADR-4** The hinted `LutTextMeasurer` is **demoted to an internal fallback**
  (default tests → reference; default Node production → system canvas).
- **ADR-5** Node production with no `canvas` dep → `EstimateTextMeasurer`
  fallback + a one-time warning that **advises installing the canvas package**.
- **ADR-6** Production = system canvas (browser canvas / node-canvas, host font).

## Constraints
- **The `TextMeasurer` seam already exists** and all node/label/HTML-table sizing
  routes through `measurer.measure(...)`. This mission changes *measurer wiring*
  and *tests*, not sizing rules. Do not modify sizing geometry.
- **Side-by-side migration (ADR-3):** never delete/replace the existing corpus or
  survey until the headless rules corpus is green and cut over in Batch 3.
- **Determinism:** the reference + estimate paths must be byte-identical across
  platforms (no system-font reads). Bundled-font tests read only committed fonts.
- **Browser bundle must not pull node-canvas** — load it lazily/optionally.
- Truth = the rules survey (reference vs headless goldens) + unit tests. Pre-existing
  font-independent divergences (e.g. Petersen) are out of scope — document, don't chase.

## Quality gates (run between every batch)
- `npm run typecheck` — exit 0. on_fail: fix_and_rerun
- `npm test` — all pass (current count + new tests). on_fail: fix_and_rerun
- `~/.claude/hooks/.venv/bin/lizard <edited files> -C 10 -w` — clean. on_fail: fix_and_rerun
- **Existing survey unchanged** (side-by-side): `npx tsx test/corpus/survey.ts`
  vs `/tmp/parity.before.json` → **0 regressions** on the current corpus until
  the Batch-3 cutover. on_fail: STOP
- **Rules gate (from Batch 0):** reference-measurer port vs headless goldens →
  byte-exact except documented pre-existing divergences. on_fail: iterate (≤3×) then STOP
- Browser build excludes node-canvas (Batch 1+): verify the browser entry has no
  static `canvas` import. on_fail: fix_and_rerun

## Stop conditions
- The rules gate cannot reach byte-exact (after isolating pre-existing divergences)
  → STOP; the layout rules may not be as decoupled as the spike suggested.
- Any **existing-corpus** regression introduced before cutover → STOP (side-by-side
  invariant violated).
- node-canvas leaks into the browser bundle and can't be made lazy → STOP, re-scope.
- A sizing-geometry change is needed to make a measurer fit → STOP (out of scope).

## Push-forward (decide autonomously)
- Reference-font choice for bundled tests (open decision §7.3) — pick open-license
  metric-compatible fonts (Liberation/Tinos/Cousine, Nimbus, DejaVu), log the choice.
- Exact warning wording for ADR-5. Test helper structure. Which JS shaper
  (fontkit for kern; add harfbuzzjs only if ligature coverage needs it).

## Batches (sequential; each gated)
| Batch | Task | Writes | Gate |
|-------|------|--------|------|
| 0 | [x] [T0.1 EstimateTextMeasurer](batch-0/T0.1-estimate-measurer.md) | textmeasure.ts (+factory) | reference measurer exists, unit-tested |
| 0 | [x] [T0.2 headless rules corpus (side-by-side)](batch-0/T0.2-headless-corpus.md) | test/corpus/* (new) | reference vs headless byte-exact (modulo pre-existing) |
| 1 | [x] [T1.1 public setTextMeasurer + resolution chain](batch-1/T1.1-measurer-api.md) | textmeasure-factory.ts, context.ts, index.ts | API public; browser excludes node-canvas; LUT demoted |
| 2 | [T2.1 bundled-font measurement tests](batch-2/T2.1-bundled-tests.md) | test/fonts/*, test helpers | kern/ligature/charset unit tests pass |
| 3 | [T3.1 production wiring + docs](batch-3/T3.1-production.md) | factory, docs | Node→node-canvas, browser→canvas, warning advises install |
| 3 | [T3.2 cut over rules corpus](batch-3/T3.2-cutover.md) | test/corpus/* | old corpus retired; rules corpus is the survey |

## Index
- [DESIGN.md](DESIGN.md) — the architecture + spike evidence
- [decisions.md](decisions.md) — ADR-1..6
- [decision-journal.md](decision-journal.md) — appended during execution
- [repro/b69-min-noconc.gv](repro/b69-min-noconc.gv) — minimal repro (no concentrate)

## Background (read if context is fresh)
- Root cause: text width measurement differs by hinting+kerning; layout rules are
  faithful (DESIGN.md §2). The port already has `estimate_text_width_1pt` (raw,
  matches headless dot) and `freetypeHintedWidth` (hinted, matches pango minus kern).
- Headless oracle recipe (validated): minimal `GVBINDIR` (core + dot_layout only),
  `dot -c` to regen config → `estimate_textspan_size`. See DESIGN.md §5.1.
- Seam: `TextMeasurer` (textmeasure.ts), `GvcContext.textMeasurer`,
  `createMeasurer()` (textmeasure-factory.ts), consumed in `make-label.ts`.
