<!-- SPDX-License-Identifier: EPL-2.0 -->

# T2 — Oracle-pin the 5 grd* cases + golden + survey

## Context

Depends on **T1** (gradient fill implemented). This task proves the fix against
the native `dot` oracle, locks one case as a golden, and refreshes the parity
survey. Native oracle = the installed `dot` (15.1.0); never WASM/approximation
(per memory `oracle-native-not-wasm`).

## Task

1. **Verify gradient counts now match the oracle.** For each of
   `grdfillcolor`, `grdlinear`, `grdlinear_angle`, `grdradial`,
   `grdradial_angle` (find inputs under `~/git/graphviz/tests/graphs/`):
   - `npx tsx test/corpus/render-one.ts <input> dot > /tmp/port.svg`
   - `dot -Tsvg <input> > /tmp/oracle.svg`
   - Assert equal count of `<linearGradient`/`<radialGradient` and equal
     `fill="url(#…)"` count. Confirm `grdradial*` produce `<radialGradient>`.
   - If any case still diverges in element tree, do NOT mark done — report which
     and the first differing element back for T1 follow-up.
2. **Add a golden** for one linear case (`grdfillcolor` — smallest) and, if a
   radial case verifies cleanly, optionally a second golden for `grdradial`
   (push-forward; log the choice):
   - Copy input to `test/golden/inputs/dot-htmltable-grad-linear.dot`
     (EPL-2.0-comment-free DOT is fine; keep the graph as-is).
   - Generate the reference with the native oracle:
     `dot -Tsvg test/golden/inputs/dot-htmltable-grad-linear.dot > test/golden/refs/dot-htmltable-grad-linear.svg`
   - Add a `manifest.json` entry (`toleranceClass: "deterministic"`, engine
     `dot`, a clear description).
   - Run `npx vitest run test/golden/suite.test.ts` — the new golden must pass
     (port output matches the oracle ref within tolerance). The manifest count
     goes 154 → 155 (or 156 with the radial golden).
3. **Regenerate the parity survey** so the dashboard reflects the wins:
   `npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts`.
   Confirm the 5 `graphs-grd*` ids move out of `diverged` (to byte-match or
   structural-match) with **zero regressions** elsewhere (compare the
   byte-match/structural/diverged totals before vs after; the 6 grd* control
   cases stay byte-match).
4. **Append a decision-journal entry**: cases fixed, before/after parity totals,
   any case that did NOT flip and why, golden(s) added.

## Write-set

- `test/golden/inputs/dot-htmltable-grad-linear.dot` (create; + radial if added)
- `test/golden/refs/dot-htmltable-grad-linear.svg` (create — native oracle output)
- `test/golden/manifest.json` (modify — add entry/entries)
- `test/corpus/parity.json` (regenerate)
- `test/corpus/PARITY.md` (regenerate)
- `plans/htmltable-gradient-fill/decision-journal.md` (append)

Do NOT edit `src/**` — if a source change is needed, the fix is incomplete:
STOP and route back to T1.

## Read-set

- `test/golden/manifest.json` (entry shape), `test/golden/suite.test.ts`,
  `test/golden/run.sh` (how refs/goldens work)
- `test/corpus/survey.ts`, `test/corpus/dashboard.ts` (regeneration commands)
- `test/corpus/render-one.ts` (how to render one input)

## Interface inputs (from T1)

Port emits one `<linearGradient>`/`<radialGradient>` per gradient table/cell
bgcolor with `id` `l_N`/`r_N` and `fill="url(#l_N)"` on the polygon.

## Acceptance criteria

- Given each of the 5 grd* inputs, when rendered by the port, then its
  `<linearGradient>`+`<radialGradient>` count equals the oracle's.
- Given the new golden, when `vitest run test/golden/suite.test.ts` runs, then it
  passes within `deterministic` tolerance and the manifest count increased.
- Given the regenerated `parity.json`, then the 5 `graphs-grd*` ids are no longer
  `diverged` and no previously-passing id regressed.

## Observability / Rollback

N/A — test artifacts only. Reversible (revert commit).

## Quality bar

`npx vitest run` exits 0. Report only: cases flipped, parity delta
(byte-match/structural/diverged before→after), goldens added, any holdout.

## Commit

`test(htmltable): golden + parity refresh for table gradient fills`
