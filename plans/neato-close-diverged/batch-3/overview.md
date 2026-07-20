<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 3 — residual bucket fixes (parallel, worktree-isolated)

Three tasks over **non-overlapping** files, each in its own git worktree
(`isolation: worktree`) so their live-source sweeps don't collide (D5). All
depend on T2's `residual-tracker.md`. Skip any task whose residual bucket T2
found empty (journal "empty after B1 cascade collapse").

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | B3 cluster-draw under neato | debugger (worktree) | `src/layout/neato/index.ts` (addClusters region) + cluster bbox helper it identifies | T2 | [ ] |
| T4 | B4 edge-label `_ldraw_` placement | debugger (worktree) | edge-label placement module (located in T4) | T2 | [ ] |
| T5 | B2+B5 splines & arrowheads | debugger (worktree) | `src/layout/neato/{splines,multispline,multispline-router}.ts` | T2 | [ ] |

**File-ownership check:** T3 owns the neato cluster region, T4 owns the label
module, T5 owns the spline modules — disjoint. If T3 and T5 both need to edit
`src/layout/neato/index.ts`, collapse the overlapping edit into whichever task
proves the cause and route the other through it (do NOT let two worktrees write
the same file, then merge blindly). After all three merge, T6 runs the combined
broad sweep to catch any interaction.
