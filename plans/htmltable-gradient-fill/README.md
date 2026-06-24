<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: HTML-table gradient bgcolor fills

## Objective

Make HTML-like label tables emit **gradient** `bgcolor` fills (linear and
radial) instead of collapsing them to a solid first-stop color. The port
already emits graph/cluster/node gradients byte-exact; it drops the gradient
for `<TABLE>` and `<TD>` backgrounds, emitting `fill="yellow"` for
`bgcolor="yellow:violet"`. The oracle emits ~73 gradients per grd* graph (3
structural + ~70 table-cell); the port emits only the 3 structural ones. Wire
the existing `parseGradientSpec` + `svg-gradient.ts` machinery into the
HTML-table fill path so the table-cell gradients are emitted too.

## Target cases (parity, dot engine, all `maxDelta=0`)

`grdfillcolor` · `grdlinear` · `grdlinear_angle` · `grdradial` ·
`grdradial_angle` (corpus ids `graphs-grd*`). All diverge at
`svg/g[1]/g[2][childCount]` with **zero coordinate drift** — geometry is
already exact; only the gradient elements are missing. Byte-matching control
cases that must NOT regress: `graphs-grdlinear_node`, `graphs-grdradial_node`,
`graphs-grdshapes`, `graphs-grdangles`, `graphs-grdcluster`, `graphs-grdcolors`.

## Branch

`feature/htmltable-gradient-fill` (squash-merge per pr-workflow.md).

## Root cause (confirmed)

`src/common/htmltable-emit.ts:98-100` (`emitBgFill`) calls `parseGradientSpec`
then **discards** the gradient: `const solid = spec ? spec[0] : bgcolor` and
fills solid via `withHtmlPaint({ fill: solid })`. `withHtmlPaint`
(`htmltable-emit-fill.ts`) only ever sets `FillType.Solid`. Fix: thread the
gradient spec + `gradientangle` + `style` (radial) through to `withHtmlPaint`,
which sets `FillType.Linear/Radial` + `stopColor`/`gradientAngle`/`gradientFrac`
on the paint obj — mirroring `applyGradientFields` (poly-gencode.ts) and C
`setFill` (htmltable.c:347-365). The SVG renderer already emits the
`<defs>`/`<linearGradient>`/`<radialGradient>` + `fill="url(#l_N)"` from those
fields and auto-increments the `l_N` counter.

## Constraints

### Stop conditions
- A target file needs changes outside the declared write-set, and no other task
  owns it.
- 2 consecutive quality-gate failures on the same check.
- The fix would require touching `svg-gradient.ts` or the `l_N` counter (signals
  the renderer path is NOT already correct — re-investigate before proceeding;
  the premise is that node/cluster gradients prove it works).
- A control byte-match case (grdlinear_node etc.) regresses and the cause is not
  a within-scope table-fill change.

### Push-forward (decide and log)
- Exact `HtmlPaint` field names / shape of the gradient extension.
- Whether to add a second golden (radial as well as linear).
- Minor test-structure choices within the existing test files.

## Quality gates

Run between tasks; all must pass.

- `command: npm run typecheck` · pass: exit 0 · on_fail: fix_and_rerun
- `command: npx vitest run src/common/htmltable-emit.test.ts src/common/htmltable-emit-fill.test.ts` · pass: exit 0 · on_fail: fix_and_rerun
- `command: npx vitest run` · pass: exit 0 (full suite, no regressions) · on_fail: fix_and_rerun
- `command: git diff --name-only HEAD` · pass: only declared write-set paths · on_fail: stop

## Architecture decisions

See [decisions.md](./decisions.md) — D1: gradient resolution lives in
`withHtmlPaint` (mirrors C `setFill` boundary).

## Batches

| Batch | Status | Summary |
|-------|--------|---------|
| [batch-1](./batch-1/overview.md) | [x] | T1 implement gradient fill + unit tests; T2 oracle-pin 5 grd* cases + golden + survey |

## Outcome (2026-06-22)

**Objective MET.** HTML-like tables/cells now emit gradient `bgcolor` fills
(linear + radial) byte-matching the oracle. Commits: `1f18afa` (feat),
`1e3d1d3` (test).

- Gradient counts verified against native `dot` 15.0.0 — all 5 grd* graphs emit
  the oracle's exact `<linearGradient>`/`<radialGradient>`/`fill="url(#…)"`
  counts (the ~70 dropped table-cell gradients per graph).
- 2 goldens added (linear + radial), both byte-match the oracle. Manifest
  154 → 156. Full suite 2285 / typecheck 0 / zero parity regressions.
- **5 grd* corpus ids stay `diverged`** on a *separate pre-existing* gap — not
  the gradient. `style=rounded` tables emit `<polygon>` not `<path>` (gradient
  bbox follows the rounded shape → 3.54pt shift); bordered-cell fills omit
  `stroke-width`. Documented in [comparisons/](./comparisons/). Follow-on:
  rounded HTML-table `<path>` emission (reuse `emitRoundedBezier`).
- Authorized scope expansion: split `htmltable-pos.ts` (621→430) to
  `htmltable-pos-runs.ts` (the 500-line hook blocked the required
  `gradientangle` thread-through). Behavior-preserving; suite green.

## Diagrams

- [diagrams/data-flow.md](./diagrams/data-flow.md) — bgcolor → gradient emit sequence
- [diagrams/component-map.md](./diagrams/component-map.md) — touched modules

## Decision journal

[decision-journal.md](./decision-journal.md) — append non-trivial calls here.
