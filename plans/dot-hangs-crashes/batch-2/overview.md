<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 2 — remaining recursion + conditional mincross

Runs after batch-1. Both tasks read T1's measured timings (logged at end of
batch-1) to scope themselves.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | Convert remaining O(V) recursions surfaced by 2108 to iterative | typescript-pro | `src/layout/dot/acyclic.ts`, `src/layout/dot/straight-edges.ts`, `src/layout/dot/ns-subtree.ts` (only those that overflow) | T1 | [x] |
| T3 | Mincross per-op cost reduction (CONDITIONAL) | typescript-pro | `src/layout/dot/mincross.ts` (+ mincross-*.ts as needed) | T1 | [x] |

## Gating

- **T2 is mandatory only if** 2108 (or any corpus input) still overflows the V8
  stack at **default** size after T1's `rerank` conversion. T1 should have made
  2108 render; if it did, T2 may be a **no-op** — confirm by scanning the dot
  critical path for any remaining O(V)-depth self-recursion
  (`acyclic.ts dfs`, `straight-edges.ts dfs`, `ns-subtree.ts treeAdjust`) and
  stress-testing a deep chain (e.g. a synthetic 50k-node path graph). If none
  overflow, mark T2 done with a journal note and skip the edits.
- **T3 runs only if** after T1 the heaviest case (2471) is still **> ~3× native**
  (i.e. > ~1.5s). If T1 already brought 2471 within 3×, skip T3 (journal note).
  The mincross hotspots are `reorderInner`, `accumCross`, `transposeStep`,
  `rcross` (~12% combined on 2471).

T2 and T3 write disjoint files and may run in parallel if both are needed.

## Quality gate

All gates in `../README.md#quality-gates`, plus: a synthetic deep-chain graph
renders without stack overflow at default V8 stack; re-timed cases logged.
