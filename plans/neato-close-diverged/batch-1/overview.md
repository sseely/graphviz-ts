<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — B1 packing / lone-node placement (the lever)

Single blocking task. The confirmed B1 root cause (disconnected-component
packing placing a lone node 11pt off) drives the 44-item graph-fill bucket and
cascades into B2/B4/B5. Must land and be re-swept before any residual triage.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Fix disconnected-component packing / lone-node placement | debugger (self, no worktree) | `src/layout/pack/poly-pack.ts`, `src/layout/pack/array-pack.ts`, `src/layout/neato/index.ts`, `src/layout/neato/init.ts` (only if sizing is the cause) | — | [ ] |

Runs in the mission branch directly (not a worktree) — it is the sole task in
its batch and every later batch depends on its committed result.
