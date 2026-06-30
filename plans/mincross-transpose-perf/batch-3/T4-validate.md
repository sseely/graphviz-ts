# T4 — validate completion, parity, and add a lasting guard

## Context

graphviz-ts (faithful TS port; `~/git/graphviz` is the spec). T2 (+T3) optimized
the mincross transpose hot path. This task proves 2471 completes, the output is
conformant to C (AD-1), and leaves a permanent regression so the win cannot
silently rot.

## Task

1. Render `tests/2471.dot` through TS to completion; record wall-clock.
2. Verify per-rank order **conformant to C** on mc3, the 6-cluster chain,
   and the mid-size benchmark (oracle order-probe, reverted after); check 2471's
   real-node per-rank order via C `-Tplain` vs TS.
3. Full `npx vitest run` — all pass, **zero golden churn**.
4. Add a **permanent** deterministic order-signature regression on the mid-size
   cluster benchmark (stable signature of the per-rank order) — the AD-1 guard.
5. Add a bounded perf smoke (benchmark transpose / 2471 mincross completes)
   guarding against future non-termination.
6. Write the journal summary + next mission.

## Read-set

- `decision-journal.md` (T1 baseline, T2/T3 results)
- `src/layout/dot/mincross-order.ts:setMincrossTrace` (trace hook)
- prior-mission order-probe recipe (`2471-blocker-is-cluster-ranking` memory)
- `README.md#harness`

## Write-set

- A new permanent test file (or additions to `mincross-cross.test.ts` /
  `mincross-order.test.ts`) for the order-signature + perf smoke
- `decision-journal.md` (summary)
- Temporary oracle order-probe — reverted after.

## Architecture decisions (locked)

AD-1 parity is the success bar (order, not just "renders"); AD-4 2471 completes.

## Interface contracts

The order-signature test consumes the post-mincross per-rank order (real node
names + virtual placeholders) and asserts a fixed signature string/hash.

## Acceptance criteria

- **Given** `tests/2471.dot`, **when** rendered in TS, **then** it completes
  (no timeout) and the wall-clock is recorded.
- **Given** mc3 + 6-cluster chain + mid-size benchmark, **when** compared to the
  C oracle, **then** per-rank order is **conformant**.
- **Given** the suite, **when** `npx vitest run`, **then** all pass, zero golden
  churn, and the new order-signature + perf-smoke tests are green.
- **Given** the new order-signature test, **when** the order is perturbed,
  **then** it fails (verified RED once).
- **Given** task end, **when** `git status` is checked, **then** only the test
  file(s) + journal changed; oracle probe reverted; C source clean.

## Observability

N/A — library-internal. The order-signature + perf-smoke tests ARE the
regression guard.

## Rollback

Reversible — tests + journal only.

## Quality bar

`npx tsc --noEmit` → 0; full suite green incl. new tests; zero golden churn;
hook limits.

## Commit

`test(T4): lock transpose perf + order parity; 2471 completes`.
Body: 2471 completion time, speedup factor, parity evidence, next mission.
