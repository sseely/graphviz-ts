<!-- SPDX-License-Identifier: EPL-2.0 -->

# T3 — Mincross per-op cost (CONDITIONAL)

## Context

After the network-simplex fix (T1), the secondary hotspot on 2471 is mincross:
`reorderInner`, `accumCross`, `transposeStep`, `rcross` (~12% combined in the
pre-fix profile). This task reduces their per-operation cost **only if** 2471 is
still **> ~3× native** (> ~1.5s) after T1. Read `decisions.md#ad-2`, `#ad-4`.

**Run condition:** confirm from the batch-1 journal entry that 2471 still misses
the 3× bar. If T1 already brought it within 3×, **skip this task** with a journal
note. Do not optimize speculatively.

## Task

Reduce per-op overhead in the mincross hot functions **without changing the
crossing-minimization algorithm, tie-breaks, or iteration counts**:

- Hoist repeated `.info.X` / accessor lookups out of inner loops into locals.
- Replace `?? 0`/`?? default` in proven-initialized hot reads with direct reads
  (AD-2), scoped to the hot loop only.
- Avoid per-iteration array/object allocation where a reused buffer suffices
  (mirror C's in-place arrays in `lib/dotgen/mincross.c`).

Forbidden: changing median/transpose ordering, tie-break comparisons (the
geometric-port tie-break and `findMaxDev` epsilon are load-bearing — see memory),
or the number of passes. Profile-guided micro-opt only.

## Write-set

- `src/layout/dot/mincross.ts`
- `src/layout/dot/mincross-*.ts` — only the file(s) containing a measured hot fn
- relevant `*.test.ts`

## Read-set

- `decisions.md#ad-2`, `#ad-4`
- `src/layout/dot/mincross.ts` (reorderInner, accumCross, transposeStep, rcross)
- C spec: `~/git/graphviz/lib/dotgen/mincross.c`
- Re-profile first: `node --prof` on 2471, confirm the current top mincross fns
  before touching anything.

## Acceptance criteria

- **Given** 2471 before/after, **when** SVGs are diffed, **then** conformant.
- **Given** 2471, **when** timed, **then** improved toward ≤ ~3× native; log the
  number. If still over after reasonable micro-opt, document the residual — do
  **not** alter the algorithm to hit the target.
- **Given** the full survey, **when** re-run, **then** zero regressions (AD-4).

## Observability

N/A.

## Rollback

Reversible. Any output change → revert.

## Quality bar

`npm run typecheck` + `npm test` + survey gate. Commit:
`perf(mincross): reduce per-op cost in hot ordering loops`. Skip entirely (journal
note) if the run condition isn't met.
