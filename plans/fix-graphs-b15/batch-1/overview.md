<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — design the collect + grouping port

Diagnosis is inherited (README). This batch produces the **implementation
design**: exactly how to change `dotSplines_`'s collect to include virtual
`splineMerge` nodes and prove the new edges coalesce into their `getMainEdge`
group (each orig routes once) — so Batch 2 implements against a pinned design,
not a guess. No `src/` change (temporary probes reverted).

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Map C's `dot_splines_` collect + group loop vs the port's; verify `getMainEdge`/`to_virt` coalesces the 6 secondary edges; write the design note (exact collect change + coalescence proof + any getMainEdge fix) | inline | `.agent-notes/graphs-b15-collect-design.md`, `decision-journal.md` | — | [x] |

Single task; notes only → no conflict with Batch 2. Output read by T2.

## Gate after batch
No code gate. Exit criterion: T1 states the exact collect change and PROVES (via
instrumented `getMainEdge` values for the 6 secondary edges + their mains) that
routing them through the existing group dispatch routes each orig once — or, if
grouping does not coalesce, names the `getMainEdge`/`to_virt` fix required. If
the doubling cannot be prevented at the grouping level, STOP (mis-scoped).
