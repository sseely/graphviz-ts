<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 0 — Diagnose the X-coordinate / ordering divergence

Read-only instrumentation. No port logic changes. Output is a precise finding
that pins Batch 1's write-set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T0 | Pin whether ldbxtried's X-divergence is cluster mincross order, x-coord NS, or cluster containment; name the exact fix locus | (inline/opus) | `.agent-notes/` only | — | [x] |

**Finding:** `divergentStage = cluster-mincross-order`. The ReMincross pass
(`mincross(g,2)`) selects a different best within-rank order because
`rcross(r=3)` differs (C 19 / port 17). Cause: edge `n488->n2` (cluster→non-
cluster parallel multi-edge) has `ED_xpenalty=2` in C but `1` in the port — the
port's `interclexp` (cluster.ts) iterates incident edges in `g.edges`
insertion order, not C's `agfstedge` order, so parallel intercluster
multi-edges land non-adjacent, `prev`-chaining fails, and the parallel's
xpenalty is never merged into the direct fast edge that `rcross` reads.
**fixTarget: `src/layout/dot/cluster.ts::interclexp`** (iterate
`[...n.outEdges(g), ...n.inEdges(g)]`). Full detail:
`.agent-notes/ldbxtried-xdivergence.md`.

Batch 1 cannot start until T0 names the divergent stage (cluster-mincross-order
| x-coord-NS | cluster-containment) and the C rule to replicate.

Spec: `T0-diagnose.md`.
