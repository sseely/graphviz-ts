<!-- SPDX-License-Identifier: EPL-2.0 -->

# T2.1 — Survey verification + perf

## Gate result: **PASS — 0 regressions**
```
rules-gate: stable=605 improvements=13 pre-existing=163 allowlisted=3 regressions=0
GATE PASS — no rules regressions vs the pango baseline.
```
Headless survey (`GVBINDIR=/tmp/ghl`, estimate path), concurrency 8, timeout floor
= 5× slowest native (817.8s) so the heavy tail completes without contention
false-timeouts.

## My fix's ISOLATED effect (headless pre/post per-id diff)
Comparing the committed pre-fix `parity-rules.json` to the post-fix run (same
oracle), so this excludes measurement-path gains:

**Improved by the fix (3):** `graphs-pmpipe`, `share-pmpipe`, `windows-pmpipe` —
`diverged → structural-match` (maxΔ 68→11). pmpipe has parallel/opposing
cross-rank edges that now route the corridor.

**Regressed (0).** No input flipped to a worse verdict.

**Edge-level (no verdict flip):** many graphs gain a faithful corridor route on
their parallel/opposing multi-rank edges (e.g. ldbxtried `n0->n2` ×3: 4-pt
straight-to-vnode → 10-pt corridor reaching n2) without changing their whole-SVG
verdict.

### Attribution note — the gate's "13 improvements" are mostly measurement-path
The gate compares the post-fix HEADLESS survey to the committed PANGO baseline, so
its 13 improvements (NaN, b102, b143, 2193, xx, …) conflate the LUT→estimate
measurement change with the fix. In the PRE-FIX headless survey those graphs were
already structural/byte (NaN maxΔ=18, b102 maxΔ=1), so they are NOT the fix's
doing. The fix's clean headless effect is the 3 pmpipe flips + edge-level
corrections above.

## `ldbxtried` — honest accounting (deviates from the plan's optimistic prediction)
T2.1 predicted ldbxtried would flip diverged→structural or show a much smaller
maxΔ. Reality: **still diverged, maxΔ=323 (unchanged).** The fix corrected the
motivating parallel `n0->n2` ×3 edges (they now route the up-right-down corridor
and reach n2, structural ~1px residual), but the graph's WORST delta MOVED from
`n0->n2` (fixed) to the lone `n0->n1` edge: routing the n0->n2 group now calls
`recover_slack`, repositioning shared chain virtual nodes, and the lone-edge
router (`edge-route.ts`, outside this mission's write-set) under-segments `n0->n1`
from those moved vnodes. So the parallel-routing OBJECTIVE is met; ldbxtried stays
diverged on a separate lone-edge bug (follow-up — see
`.agent-notes/parallel-corridor-fix-and-lone-recoverslack-followup.md`).

## Perf — no regression (≤2× native on previously-passing inputs)
Targeted bench (`dist/index.js`, warm pool) on the routing-changed graphs:

| id | native | port | ratio |
|---|---:|---:|---:|
| `2193` | 58ms | 21ms | 0.36× |
| `graphs-NaN` | 64ms | 14ms | 0.22× |
| `graphs-ldbxtried` | 61ms | 10ms | 0.16× |
| `graphs-pmpipe` | 58ms | 2ms | 0.04× |

All routing-changed graphs render **faster than native**. The heaviest corpus
input, `2108` (the perf worry — many parallel `n*->n2` groups), was measured
standalone at **95s pre-fix AND 95s post-fix (identical)** by checking out
`ac4dbcb^` vs HEAD; native `2108` = 13s, so its ~7× ratio is the PRE-EXISTING
mincross cost ([[mincross-perf-is-perop-not-iteration]]), unchanged by edge
routing. No previously-passing input exceeds 2× native because of the fix.

## Survey-harness fixes made during verification (tooling)
1. **Dynamic timeout floor** (`6020391`): the fixed 180s floor falsely flagged
   2108/1718 as timeout under 8-way concurrency (95s/77s standalone, inflated by
   CPU contention). Floor is now `5× slowest canonical native` (here 817.8s),
   scaling per-host; env `RENDER_TIMEOUT_FLOOR_MS` still overrides. Result:
   timeout count 6 (contended) → 1; 2108→structural-match, 1718→diverged, and
   2095_1/2343/2371 completed (timeout→diverged, real verdicts).
2. **`survey:fast`** (`d1280cd`): `SURVEY_MAX_PORT_MS` (default 60000 via
   `npm run survey:fast`) pre-excludes the 6 graphs whose warm port render >60s,
   for routine "did we break anything?" runs that focus on reasonable-time
   divergences and defer the slow/timeout tail.

## Verdict
GO to T2.2. Fix is net-positive (pmpipe ×3 + broad edge-level corridor fidelity),
0 regressions, perf clean. The one deviation (ldbxtried stays diverged) is an
out-of-scope lone-edge follow-up, fully documented.
