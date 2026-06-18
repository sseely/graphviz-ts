# T3 — Apply the faithful NS fix + verify 2471 end-to-end

## Context

Batch 2 pinned the exact `ns.c` deviation in `ns-root-cause.md`. Apply the
faithful fix and prove 2471 renders end-to-end with x-order == C and zero golden
churn. This closes the 2471 effort and makes the branch merge-ready.

## Task

1. Apply the faithful fix from `ns-root-cause.md` to `ns.ts` and/or
   `ns-core.ts` — match C's behavior exactly (no non-C heuristic; ADR-1).
2. Add a regression test (`ns.test.ts` or `ns-core.test.ts`) that exercises the
   fixed primitive (e.g. convergence on a degenerate/windowed aux graph, or the
   specific cut-value/low-lim case). Follow the complexity hook (file <500
   lines, CCN <=10); split into a new test file if needed.
3. Verify end-to-end (see acceptance criteria).
4. Revert any C instrumentation; confirm C repo clean.

## Write-set

- `src/layout/dot/ns.ts` and/or `src/layout/dot/ns-core.ts`
- `src/layout/dot/ns.test.ts` and/or `src/layout/dot/ns-core.test.ts`
  (new test file allowed if the existing one would exceed the 500-line hook)

## Read-set

- `../batch-2/ns-root-cause.md` (the fix spec — primary)
- `src/layout/dot/ns.ts`, `src/layout/dot/ns-core.ts` (fix sites)
- C: `~/git/graphviz/lib/common/ns.c` (the relevant primitive)
- `decisions.md#adr-1` (faithful-only)

## Architecture decisions (locked)

ADR-1 (faithful-only — match C, no heuristic/cap), ADR-2 (native-C verify).

## Acceptance criteria

- Given the fix, when 2471 renders end-to-end, then it completes < 60s.
- Given the fix, when 2471 x-order per rank is compared to C, then identical.
- Given the fix, when the full suite + goldens run, then **zero churn** and
  `npm test` (>=1876) / `npm run typecheck` / `npm run build` all green.
- Given the fix, when `git -C ~/git/graphviz status --porcelain lib/` runs, then empty.
- Given all green, when noted in the journal, then
  `feature/mincross-2471-faithful` is flagged merge-ready (human merges).

## Observability

N/A — layout algorithm; the regression test is the durable guard.

## Rollback

Reversible — single fix commit on the branch; reverts cleanly. No migration.
C source untouched.

## Commit

One commit: `fix(T3): <faithful ns deviation> for x-coord convergence`. Body
explains the C-vs-TS deviation (why), references `ns.c` lines. Per
`~/.claude/rules/commits.md`.
