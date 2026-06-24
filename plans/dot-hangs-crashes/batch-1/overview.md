<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — core perf + parser

Two disjoint subsystems, fully parallel (no shared files).

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Network-simplex hot-path: flat dfsRange stack, iterative rerank, de-guard hot reads | typescript-pro | `src/layout/dot/ns.ts`, `src/layout/dot/ns-range.ts`, `src/layout/dot/ns-core.ts` (+ test) | — | [x] |
| T4 | Parser recovery / won't-fix triage for 5 errored fuzzer inputs | typescript-pro | `src/parser/dot.pegjs`, `src/parser/dot.js` (regen), parser test | — | [x] |

## Notes

- T1 owns the entire network-simplex subsystem as **one logical unit** (the three
  `ns*.ts` files are tightly coupled; one writer avoids conflict). It covers both
  the perf hotspot (AD-1, AD-2) **and** the `rerank` iterative conversion (AD-3),
  because `rerank` lives in `ns.ts` which T1 already owns.
- T4 is independent (parser layer) and can run concurrently.
- After T1 lands, **measure** all 7 timeout cases (port vs native). Those timings
  decide whether T3 (mincross) runs in batch-2. Record them in the journal.

## Quality gate (end of batch)

Run all gates in `../README.md#quality-gates`. Additionally re-time 2471 / 1718 /
2475_2 / b100 / 2108 and log results. 2108 **must** render at default stack after
T1 (rerank was the confirmed culprit); if it still overflows, batch-2 T2 picks up
the remaining recursion — note which frame in the journal.
