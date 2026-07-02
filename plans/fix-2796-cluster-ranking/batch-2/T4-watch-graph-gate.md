<!-- SPDX-License-Identifier: EPL-2.0 -->
# T4 — Watch-graph gate (CONDITIONAL)

## Context
T2 changed cluster-ranking constraint construction shared by every dot
render with clusters. Verify blast radius before the survey. (Skipped
along with the whole batch if T1 = INPUTS-MATCH.)

## Task
1. Render pre/post-batch (pre = T1 commit, via temp `git worktree`) for
   the watch set: `graphs/b53.gv`, `1767.dot`, `1221.dot`, `2721.dot`,
   `2471.dot`, `2475_2.dot`, `1332.dot` + the NaN ids (prior-mission
   guards), plus 2–3 cluster-heavy picks of your choice (log the choice).
2. Byte-compare each vs pre. Any difference: per-element vs the ORACLE —
   every changed element must move toward the oracle with a stated
   mechanism. Away-from-oracle = stop.
3. Time the 2475_2 render pre/post (NS hot-path canary; must stay within
   the same order — no 180s-cap risk).
4. Log per-graph results to the journal; agent note only if something
   non-obvious surfaced.

## Write-set
`.agent-notes/`, `plans/fix-2796-cluster-ranking/decision-journal.md`.

## Acceptance criteria
- Given each watch graph, when byte-compared pre/post, then identical OR
  every difference is toward the oracle with a stated mechanism.
- Given 2475_2, when timed, then no material slowdown (journal numbers).
- Given 2796, when re-measured, then its state is journaled (movement
  toward the oracle is fine; its layout is NOT a gate — D1).

## Observability / Rollback
N/A. Reversible (notes only).

## Commit
`docs(T4): watch-graph gate results for 2796 ranking fixes` (only if a
note was produced; otherwise fold the journal row into the next commit).
