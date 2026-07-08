# Mission: Finish xdot generation — conformance to native `dot -Txdot`

**Branch:** `feature/xdot-conformance` · **Model:** `claude-opus-4-8` (long-horizon)
**Origin:** supersedes the `plans/fix-xdot-renderer/` draft (T6 of expose-library-api).

## Objective

Every graph that renders **conformant** to native `dot -Tsvg` must also render
conformant to native `dot -Txdot`. Layout is already correct (these graphs are
SVG-conformant) — this is an **emission** problem in `XdotRenderer`
(`src/render/dot.ts`). Build an xdot conformance harness that reuses the SVG
testing seams, walk the 759 conformant corpus items **sorted by input file size
(small → large)**, and **stop at the first divergence, fix it at the root, then
resume** — so simple graphs pin the core bugs before large graphs exercise the
edge cases.

## Method (the whole mission in one paragraph)

Batch 1 builds the harness (render-one-xdot + semantic comparator + walker +
dashboard). Batch 2 is a **loop**: run the walker (stop-on-first-divergence),
diagnose the reported divergence to root cause per `~/.claude/rules/diagnosis.md`,
fix it in `src/render/dot.ts` (or `src/gvc/device.ts` if shared), one commit,
re-run. Repeat until all conformant items pass or a stop condition fires.
Irreducible C quirks (font-metric ULP, platform libm) are recorded in
`accepted-divergences-xdot.json` and the walk continues.

## Locked decisions (see `decisions.md`)

- **AD-1 Comparator: semantic.** Compare `_draw_/_ldraw_/_hdraw_/_gdraw_/_tdraw_`
  op streams + `pos/bb/width/height` at **0.01** tolerance; canonicalize colors
  and font names; ignore attribute formatting/order and the `node [label="\N"]`
  line. Reuse `src/xdot/parseXDot`.
- **AD-2 Conformant set:** the 759 `verdict:"conformant"` entries in
  `test/corpus/parity.json`; sort by `stat` size of each `.dot` at `CORPUS_ROOT`.
- **AD-3 Execution: stop-on-first-divergence, fix, resume.** Default walker mode.
- **AD-4 Oracle:** native `dot -Txdot`, `GVBINDIR=/tmp/ghl` — the same headless
  recipe as the SVG survey. Reuse `survey.ts` spawn + oracle-cache pattern.
- **AD-5 Scope:** plain `xdot` (v1.7) only. `xdot1.2/1.4/canon` out (dot.ts AD-12).
- **AD-6 Deliverable: both modes.** Default stop-and-fix; `--survey` writes
  `xdot-parity.json` + `PARITY-XDOT.md` (full fix-up list + permanent gate).
- **AD-7 Irreducibles:** record in `accepted-divergences-xdot.json`, continue.

## Constraints

### Stop and ask the human when:
- A divergence traces to **layout** (node coord / spline geometry), not emission
  — this violates the SVG-conformant premise.
- SVG `rules-gate.ts` reports **regressions > 0** after a fix (shared
  `device.ts` broke the SVG renderer).
- The same code location is changed **3×** without resolving the same divergence.
- Two consecutive quality-gate failures on the same check.
- A fix would require editing files outside the write-set (see below).

### Push forward with judgment when:
- A divergence is an **irreducible C quirk** → record in
  `accepted-divergences-xdot.json`, continue.
- A **new draw-op class** surfaces from a bigger graph (style `S`, cluster
  `_gdraw_`, gradient, image, record) → diagnose + fix inline, one commit.
- The difference is **cosmetic formatting** → already ignored by the semantic
  comparator; never surfaced.

### Write-set (whole mission)
`src/render/dot.ts`, `src/gvc/device.ts` (guarded), `src/render/*` color/font
helpers, and everything under `test/corpus/` + `test/golden/` created below.
Anything else → stop.

## Quality gates (run after every fix)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm test
  pass: exit 0 (existing xdot unit tests + new compare-xdot.test.ts green)
  on_fail: fix_and_rerun
- command: npx tsx test/corpus/xdot-walk.ts --survey && npx tsx test/corpus/xdot-dashboard.ts
  pass: xdot pass-count strictly greater than previous run (monotonic)
  on_fail: stop
- command: GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts && npx tsx test/corpus/rules-gate.ts
  pass: SVG regressions = 0
  on_fail: stop
```

> The SVG survey gate only needs to run after a fix that touches
> `src/gvc/device.ts` or a shared helper. Fixes confined to the `XdotRenderer`
> class in `dot.ts` cannot affect SVG — skip the SVG gate for those (note it in
> the decision journal).

## Batches

| Batch | Description | Status |
|-------|-------------|--------|
| [1](batch-1/overview.md) | Build the xdot conformance harness (no renderer changes) | [x] |
| [2](batch-2/overview.md) | Walk conformant items small→large; fix-loop to conformant | [x] **752 conformant + 4 accepted / 759**; only 2 diverged, both out-of-scope: 1514 (cgraph model), pgram (parser-limit); 1652 perf-timeout. Every emission bug fixed; 2825 layout bug root-caused + fixed (plans/layout-bugs/). |

## Index
- [decisions.md](decisions.md) — architecture decisions (AD-1…AD-7)
- [batch-1/overview.md](batch-1/overview.md) — T1–T4 harness tasks
- [batch-2/overview.md](batch-2/overview.md) + [batch-2/fix-loop.md](batch-2/fix-loop.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) · [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
