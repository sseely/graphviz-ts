<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: long-edge spline extra-segment divergence

## Objective

Long edges (spanning many ranks) render with **one extra cubic bezier piece**
versus the native `dot` oracle: the port subdivides a spline where C fits a
single smooth bezier. This is the dominant remaining `path/@d` divergence on the
`rankdir_dot*` cluster (and ~49 Helvetica corpus rows) after the font-metric fix
landed node/text/label byte-match. The recursive fitter (`src/pathplan/route.ts`)
is a **faithful** port of C `reallyroutespline`; the bug is **upstream** — the
box corridor, the input-point chain, or the endpoint slopes handed to
`Proutespline`. The exact site is **not yet localized**: Batch 1 is a spike that
pins it before any fix is written.

## Spike-first (read before planning the fix)

This brief is deliberately **speculative on the fix**. The fix task's write-set,
approach, and acceptance are filled in by the executor **after** Batch 1's
localization, recorded in [decision-journal.md](./decision-journal.md) and
[decisions.md#d-fixsite](./decisions.md). Do **not** pre-commit a fix file.

## Branch

`feature/edge-spline-routing` — merge commit to `main` (per-task commit IDs
referenced in the journal; do not squash).

## What is known (investigation, `src/.agent-notes/edge-spline-extra-segments.md`)

- rankdir_dot: 46/49 edge paths match exactly (median coord delta 0.0); 3 long
  edges emit 1 extra cubic each (e.g. oracle 2 cubics / port 3).
- The fitter `route.ts` matches C constants exactly (`EPSILON1=1e-3`, `a=4`,
  `a<0.005`, `forceflag`, `distN` shortcut) — NOT the bug.
- Minimal reproducer: `/tmp/le_long.gv` (rankdir=LR n0..n15 + long spans; path 23
  diverges oracle 1 cubic / port 2). Small 6-node chains do NOT reproduce.
- Node positions byte-match the oracle, so box GEOMETRY should match unless the
  long-edge corridor construction (`src/common/splines-routespl.ts` / dot
  edge-route chain) diverges.

## Constraints

**Stop and ask** when: the fix needs a file outside the (post-spike) write-set
that is in no other task's write-set; two consecutive quality-gate failures on
the same check; the same location is changed ≥3× without resolving a failing
check; the implementation would contradict [decisions.md](./decisions.md); **any
of the 280 existing byte-match rows regress** (D-regress); the spike shows the
divergence is in the faithful fitter after all (contradicts the premise — stop
and re-scope).

**Push forward** (log to journal) when: a choice is purely stylistic; pinning a
constant/tolerance directly from instrumented C; the fix is smaller than a full
task; an obvious self-explanatory fix.

## Quality gates (run between every batch)

```
- command: npx tsc --noEmit --stableTypeOrdering
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0
  on_fail: fix_and_rerun
- command: git diff --name-only main
  pass: only files in completed tasks' write-sets
  on_fail: stop
```

Regression scan (Batch 3): `npx tsx test/corpus/survey.ts` then confirm
`byte-match >= 280` and `errored`/`timeout`/`diverged` do not rise (per-id diff,
0 regressions). Oracle: `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot`.

## Baseline (pre-flight — executor must confirm)

- `feature/edge-spline-routing` does not exist.
- `npx tsc --noEmit` clean; `npx vitest run` green (~2314).
- `main` at the font-aware-vmetrics merge (parity byte-match 280).

## Batches

| Batch | Task | Status |
|-------|------|--------|
| 1 | [S1 — localize the divergence (spike)](./batch-1/S1-localize.md) | [x] |
| 2 | [T2 — fix the localized divergence](./batch-2/T2-fix.md) | [x] |
| 3 | [T3 — verify + regression scan](./batch-3/T3-verify.md) | [x] |

Batches are **sequential**: T2's write-set is unknown until S1 completes; T3
verifies T2. One commit per task, `type(Sn/Tn): …`.

## Index

- [decisions.md](./decisions.md) — D1–D5 (incl. the post-spike fix-site slot)
- [batch-1/overview.md](./batch-1/overview.md) · [S1](./batch-1/S1-localize.md)
- [batch-2/overview.md](./batch-2/overview.md) · [T2](./batch-2/T2-fix.md)
- [batch-3/overview.md](./batch-3/overview.md) · [T3](./batch-3/T3-verify.md)
- [diagrams/data-flow.md](./diagrams/data-flow.md) · [diagrams/component-map.md](./diagrams/component-map.md)
- [decision-journal.md](./decision-journal.md)
- investigation: `src/.agent-notes/edge-spline-extra-segments.md`
