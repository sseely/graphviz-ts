<!-- SPDX-License-Identifier: EPL-2.0 -->
# T4 — 1332 + watch-graph gate

## Context
T2 (and possibly T3) changed cluster-edge routing shared by every dot
render. Verify blast radius on known-sensitive graphs before the expensive
survey.

## Task
1. Render pre/post-batch (pre = T1 commit, via a temp `git worktree`) for
   the watch set: `graphs/b53.gv`, `1767.dot`, `1221.dot`, `2721.dot`,
   `2521_1.dot`, `1624.dot`, the 3 NaN ids (guard the previous mission),
   plus 2–3 cluster-edge-heavy graphs of your choice (log the choice).
2. Byte-compare each vs pre. For any difference: per-element comparison vs
   the ORACLE — every changed element must move toward the oracle with the
   mechanism stating why. Any away-from-oracle move = stop condition.
3. Log per-graph results to the decision journal; write an agent note only
   if something non-obvious surfaced.

## Write-set
`.agent-notes/`, `plans/fix-1332-cluster-edge-routing/decision-journal.md`.

## Acceptance criteria
- Given each watch graph, when byte-compared pre/post, then identical OR
  every difference is toward the oracle with a stated mechanism.
- Given 1332, when per-element compared vs oracle, then nodes 0 and the T2
  (+T3) targets hold.

## Observability / Rollback
N/A. Reversible (notes only).

## Commit
`docs(T4): watch-graph gate results for 1332 routing fix` (only if a note
was produced; otherwise fold the journal row into the next commit).
