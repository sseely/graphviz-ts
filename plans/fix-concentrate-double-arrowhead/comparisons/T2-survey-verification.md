<!-- SPDX-License-Identifier: EPL-2.0 -->

# T2 — Survey verification: concentrate conc_opp_flag arrowhead fix

Comparison of the headless rules survey (`parity-rules.json`, port
EstimateTextMeasurer vs headless `dot` oracle) before and after the T1 fix
(`a085474`). Raw artifacts:
`parity-rules.before-fix.json` / `parity-rules.after-fix.json` (this dir).

## Primary targets — FLIPPED (diverged → structural-match)

| Input | concentrate | Before (firstDiff) | After |
|---|---|---|---|
| `graphs-b135` | true | diverged `g[3][childCount]` | **structural-match** |
| `167` | true | diverged `g[5][childCount]` | **structural-match** |
| `2087` | true | diverged `g[7][childCount]` | **structural-match** |

Goldens `concentrate-b135` and `concentrate-167` byte-match the headless oracle
(T1). The missing-arrowhead `element-count` divergence and its unclipped-spline
`@d` side effect are both gone.

## Secondary targets — partial / unaffected (verdict unchanged)

| Input | concentrate | Fix changed output? | Outcome |
|---|---|---|---|
| `graphs-b69` | true | yes (+3 arrowhead polygons) | arrowheads now correct; **retains** ~1pt node-x residual → still `element-count` diverged |
| `1453` | true | yes (+2 arrowhead polygons) | improved in part; still diverged on a separate top-level `element-count` cause |
| `graphs-b15` | true | **no** (byte-identical) | no opposing-pair merge triggers; divergence is the x-coord residual, unrelated to arrowheads |
| `2825` | true | **no** (byte-identical) | no opposing-pair merge triggers; divergence unrelated to arrowheads |

The b15/b69 x-coord residual is documented in `docs/known-divergences.md`
(cross-links the `b69-concentrate-undermerge` agent note). README predicted
`1453`/`2825` would "improve to structural/byte"; in fact `2825` and `b15` are
byte-identical with and without the fix — their `element-count` divergence has a
different (non-arrowhead) cause.

## 0-regression rule — SATISFIED for this fix

The `survey:gate` run flags 24 `match → diverged` and the before/after diff shows
34 `structural → diverged` changes. **None are caused by this fix:**

1. **Mechanism:** `arrowFlags` only changes behavior when `e.info.conc_opp_flag`
   is set, which `classify.ts` sets **only** for `concentrate=true` opposing
   pairs. Non-concentrate inputs hit byte-identical code.
2. **Classification:** every one of the 24/34 flagged inputs is
   **`concentrate=false`** (neato/circo/twopi `*_neato`/`*_circo`/`*_twopi`,
   `dfa`, `overlap`, `root`, `b94`, `badvoro`, `NaN` …). All firstDiffs are
   `path[1]/@d` edge geometry, several with maxΔ in the thousands (5167, 6888,
   4913) — impossible for an arrowhead-flag change.
3. **Byte-identity proof:** rendering `graphs/root.gv`, `linux.x86/root_circo.gv`,
   `graphs/dpd.gv`, `graphs/badvoro.gv`, `share/pm2way.gv`, `1453.dot`,
   `2825.dot`, `graphs/b15.gv` with the fix vs the pre-fix `splines-clip.ts`
   (`HEAD~1`) produced **byte-identical** SVGs for every non-improved input.

### Root cause of the flagged drift: stale committed baselines

`parity-rules.json` was last regenerated at `7b796e1`, **before** the
`text-measure-arch` merge (6 src/ commits: EstimateTextMeasurer cutover T1.1–T3.2
+ the `make_edge_pairs` trunc fix `73d9e21`). `parity.json` is older still
(`274964e`). The 34 `structural → diverged` drifts are that cutover's effect on
non-concentrate text/spline geometry — they would appear on plain `main` without
this commit.

**Decision:** the tracked `parity.json` / `parity-rules.json` / `PARITY.md` were
**not** regenerated/committed under this fix, because doing so would fold an
entire feature-merge's worth of unrelated drift into a "concentrate arrowhead"
commit (mislabeling it in git-blame and entangling rollback). Refreshing the
parity baselines to current `main` is a separate maintenance task (post-cutover
re-baseline); run on current `main` it will show the gate green **with** these 3
target flips included. The verification evidence is preserved here for
archaeology.
