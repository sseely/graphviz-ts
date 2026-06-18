# T3 — conditional second-axis optimization

## Status: CONDITIONAL

Execute **only if** T1's routing names a second, independent material cost
(e.g. pass-count fixed in T2 but per-pass constant-factor still dominates, or
vice-versa). If T1 names a single cause, **skip T3** (mark Done, note "n/a — single
cause" in the journal).

## Context

Same as T2 (faithful TS port; AD-1 parity is cardinal). This task closes the
*second* axis after T2 closed the first, so 2471 reaches a completing time.

## Task

Apply the second routed optimization (AD-5 — mirror C). Same fix-shape menu as
T2 (pass-count / non-convergence / constant-factor), at the second target site.

## Read-set

- `decision-journal.md` (T1 routing — second axis; T2 result)
- The second target site named by T1
- C anchors per the cause (see T2)

## Write-set

The routed file(s) of the AD-2 set + their `*.test.ts` (a different site than
T2). Nothing else without re-planning.

## Acceptance criteria

- **Given** T2 is merged, **when** the second axis is applied, **then** the
  benchmark transpose time drops further (record cumulative factor).
- **Given** mc3 + mid-size benchmark, **when** rendered, **then** order
  **byte-identical to C** (order-probe, reverted).
- **Given** the full suite, **when** `npx vitest run`, **then** all pass, **zero
  golden churn**.

## Observability / Rollback

N/A; reversible (revert commit).

## Quality bar

`tsc` 0; suite green, zero churn; hook limits; order == C.

## Commit

`perf(T3): <second-axis fix> — cumulative <Nx>, order unchanged`.
