# Batch 3 — validate completion, parity, and a lasting guard

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|-----------|------|
| T4 | 2471 completes + order==C + permanent regression + perf smoke | `*.test.ts`, `decision-journal.md` (+ reverted oracle probe) | T2 (+T3) | [ ] |

## Goal

Prove the AD-1 + AD-4 success predicate and leave a permanent guard so the
parity/perf win cannot silently regress.

## Checks

1. **2471 completes:** render `tests/2471.dot` through TS to completion; record
   the wall-clock (was: >90s hang).
2. **Order == C (AD-1):** oracle order-probe diff == C on mc3, the 6-cluster
   chain, and the mid-size benchmark (reuse T1 baseline; revert probe after).
   Confirm against `tests/2471.dot` at whatever granularity is tractable (real
   nodes via `-Tplain` per-rank order at minimum).
3. **Zero golden churn:** full `npx vitest run` green; every cluster golden still
   conforms to its C ref.
4. **Permanent regression:** add a deterministic order-signature test on the
   mid-size cluster benchmark (a stable hash/string of the per-rank order), so
   any future order drift fails CI cheaply — the AD-1 guard.
5. **Perf smoke:** a bounded assertion that the benchmark transpose (or 2471
   mincross) completes — guards against a future non-termination re-introduction.

## 2471 (AD-4)

If 2471 now renders: record the time and the next divergence if any (predicted:
x-coord under clusters) as the next mission. If it still does not complete after
T2(+T3): that is a STOP — re-plan (the routed fix did not move the needle).

## Deliverable

Journal summary: tasks done, transpose speedup factor, 2471 completion time,
parity evidence, golden-churn count (expect 0), and the next mission.
