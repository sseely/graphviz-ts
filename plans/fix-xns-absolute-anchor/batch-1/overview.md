# Batch 1 — Align the x-NS absolute anchor

Iteratively eliminate the pivot-order divergences the Batch-0 trace reveals, in
pivot order. Fix ONLY the first remaining divergence each step, then re-trace and
run the full survey. **Final coords must not move (AD-3): the survey stays green
and 2368 stays diverged throughout; progress is the internal-coord trace
converging to C (AD-2).** The executor runs only the candidates the trace flags
(likely a subset of T1–T5).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Align `GD_nlist` order for the x-aux graph (init_rank queue + leaveEdge sweep) | debugger | `src/layout/dot/fastgr.ts`, `src/layout/dot/position.ts` | T0 | [ ] |
| T2 | Align in/out edge-list + aux-edge insertion order (fastEdge/makeAuxEdge/makeEdgePairs) | debugger | `src/layout/dot/fastgr.ts`, `src/layout/dot/position.ts`, `src/layout/dot/position-aux.ts` | T1 | [ ] |
| T3 | Align `leaveEdge` selection (cyclic search + tie-break) | debugger | `src/layout/dot/ns.ts` | T2 | [ ] |
| T4 | Align `enterEdge` + `update`/`rerank` | debugger | `src/layout/dot/ns.ts` | T3 | [ ] |
| T5 | Align `lrBalance` (Tree_edge order, delta/2 trunc, rerank direction) | debugger | `src/layout/dot/ns.ts` | T4 | [ ] |

Execution rule: after the trace shows a divergence at one of these sites, fix
that site, re-run the Batch-0 trace + `xns-diff.mjs`, and run the survey gate.
A site whose trace already matches C is skipped (mark `[x]` "no change needed").
Batch done = port internal x-coords for 2368_1 (and a spot-check on 2368)
match C exactly AND survey shows 0 regressions.

Per-task acceptance criteria live in each `TN-*.md`. They share:
- Given the fix, when the Batch-0 trace is re-run, then the previously-first
  divergence is gone (the trace advances).
- Given the fix, when the full survey runs, then 0 regressions (no final coord
  moved) — else STOP (AD-3).
