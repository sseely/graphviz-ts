<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: long-edge spline under-segmentation residual

## Objective

With edge routing order now conformant to C (mission `edge-spline-routing`,
merge `465b24a`), the dot port still emits **one fewer cubic bezier piece** than
the native `dot` oracle on some long (multi-rank) edges. The recursive fitter
finds a 3-piece fit where C splits into 4, despite the corridor inputs now being
order-correct. This is the brief's true original target — minus the routing-order
confound. Spike-first: instrument C + port for the canonical reproducer, pin the
first differing field, then fix pinned to instrumented C.

## Canonical reproducer + targets

- **`~/git/graphviz/tests/graphs/p3.gv`, edge `sleep--runmem`**: port **3 cubics
  / oracle 4**, maxDelta **0.48** (geometry near-perfect — only the piece count
  differs). This is the cleanest signal.
- Corpus rows `linux.x86-rankdir_dot`, `linux.x86-rankdir_dot2`,
  `nshare-rankdir_dot`, `nshare-rankdir_dot2`: same `firstDiffPath`
  (`…/path[1]/@d`) class, but **larger maxDelta (~34–37)** — likely a *layered*
  divergence (under-segmentation + a separate ~7.5pt label-height LAYOUT residual
  recorded in memory `size-attr-scaling-done`). S1 must decide whether their
  residual IS the under-segmentation class or a separate one (see D5).

## Spike-first (read before planning the fix)

The fix file/approach is **unknown until S1 localizes it**. T2 is a template that
S1 rewrites from the instrumented C-vs-port diff, recorded in
[decisions.md#d-fixsite](./decisions.md). Do **not** pre-commit a fix file.

## Branch

`feature/long-edge-undersegment` — merge commit to `main` (per-task commit IDs
referenced in the journal; do not squash).

## What is known (prior art)

- The fitter `src/pathplan/route.ts` is a **faithful** port of C
  `reallyroutespline` (`EPSILON1=1e-3`, `a=4`, `a<0.005`, `forceflag`, `distN`
  shortcut). Premise: NOT the bug. If S1 implicates it → **stop & re-scope**.
- Routing order matches C **conformant** (verified in `edge-spline-routing`),
  so the corridor INPUTS are order-correct. The residual is in the box corridor
  geometry or the smode segmentation.
- The port **UNDER**-segments (emits FEWER cubics). The old investigation note
  said OVER-segments — that premise is stale; do not trust it.
- Prior art: `plans/edge-spline-routing/` (S1 method, journal,
  `comparisons/graphs-p3-residual.md`); memory `edge-routing-order-done`,
  `recover-slack-and-c-harness`, `oracle-native-not-wasm`,
  `instrument-c-before-quarantine`.

## Constraints

**Stop and ask** when: the spike implicates the faithful fitter (`route.ts`)
after all (premise contradicted — re-scope); **any of the 281 existing
conformant rows regress**; the same location is changed ≥3× without resolving a
failing check; the fix needs a file outside the localized write-set that is in no
other task's write-set; the `rankdir_dot` rows turn out to be blocked by a
SEPARATE residual class (D5 — document with comparison pages, do not chase the
unrelated layout bug).

**Push forward** (log to journal) when: a choice is purely stylistic; pinning a
constant/tolerance directly from instrumented C; the fix is smaller than a full
task; an obvious self-explanatory fix.

## Quality gates (run between every batch)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0
  on_fail: fix_and_rerun
- command: git diff --name-only main
  pass: only files in completed tasks' write-sets
  on_fail: stop
```

Regression scan (Batch 3): `npx tsx test/corpus/survey.ts` then
`npx tsx test/corpus/dashboard.ts`; confirm **conformant ≥ 281** and
`errored`/`timeout`/`diverged` do not rise (per-id diff vs `main`, **0
regressions**). Oracle: `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot`.

## Baseline (pre-flight — executor must confirm)

- `feature/long-edge-undersegment` does not exist.
- `npx tsc --noEmit` clean; `npx vitest run` green (~2320).
- `main` at the `edge-spline-routing` merge (`465b24a`), parity conformant **281**.

## Batches

| Batch | Task | Status |
|-------|------|--------|
| 1 | [S1 — localize the under-segmentation (spike)](./batch-1/S1-localize.md) | [x] |
| 2 | [T2 — fix the localized divergence](./batch-2/T2-fix.md) | [x] |
| 3 | [T3 — verify + regression scan](./batch-3/T3-verify.md) | [x] |

**Outcome:** Root cause = `normalizeXcoords` (position.ts) shifting node x by a
non-integer delta → non-integer routing frame → `maximal_bbox` `round()`
boundary-straddle → fitter piece-count flip. Fix = round the shift delta
(integer frame matches C; final positions unchanged). **graphs-p3 diverged →
conformant**; survey **conformant 282→297, 0 regressions, 18 improvements**;
vitest 2320 green. rankdir_dot/dot2 rows are a SEPARATE residual (D5) — the
x-axis fix does not resolve them; documented, not chased (D3).

Batches are **sequential**: T2's write-set is unknown until S1 completes; T3
verifies T2. One commit per task, `type(Sn/Tn): …`.

## Index

- [decisions.md](./decisions.md) — D1–D5 (incl. the post-spike fix-site slot)
- [batch-1/overview.md](./batch-1/overview.md) · [S1](./batch-1/S1-localize.md)
- [batch-2/overview.md](./batch-2/overview.md) · [T2](./batch-2/T2-fix.md)
- [batch-3/overview.md](./batch-3/overview.md) · [T3](./batch-3/T3-verify.md)
- [diagrams/data-flow.md](./diagrams/data-flow.md) · [diagrams/component-map.md](./diagrams/component-map.md)
- [decision-journal.md](./decision-journal.md)
