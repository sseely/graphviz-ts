<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 3 — Fixes for genuine input defects only (CONDITIONAL)

Populated from B2 verdicts. Only genuine port-input defects get fixes,
applied faithfully (C refs). No bug replication, no per-graph special
cases. Skipped entirely if B2 finds all inputs faithful.

| task | description | status |
|---|---|---|
| F1 | Port C's `rec_reset_vlists(g)` call in flat_edges (flat.c:333): narrow ctx params to `Pick<MincrossContext,'root'>` where only root is used (neighborNode/furthestNode/applyVlistReset/resetVlistRanks/recResetVlists), call from flatEdges reset branch with `{root: dotRoot(g)}`. Re-verify 2471 dumps (x-aux should shrink to ordering-only or zero), tsc + vitest, canary 2475_2 (position code changed). | [ ] |
