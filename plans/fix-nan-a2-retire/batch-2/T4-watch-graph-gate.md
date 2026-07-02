<!-- SPDX-License-Identifier: EPL-2.0 -->
# T4 — NaN-family + watch-graph gate

## Context
T3 changed edge routing/clipping code shared by every dot render. Before the
expensive full survey, verify the blast radius on known-sensitive graphs.

## Task
1. Render pre/post-T3 (pre = `git show HEAD~1`-era render captured before T3,
   or re-render from the T2 commit) for the watch set:
   `graphs/b15.gv`, `2559.dot`, `graphs/b69.gv`, `graphs/honda-tokoro.gv`,
   `2361.dot`, plus the 3 NaN ids and 2–3 straight-edge-heavy graphs of your
   choice (log the choice).
2. Byte-compare each vs pre-T3. For any difference: per-element comparison
   vs the ORACLE — every changed element must move toward the oracle, with
   the mechanism stating why. Any away-from-oracle move = stop condition.
3. Log results (counts per graph) to the decision journal; write an agent
   note only if something non-obvious surfaced.

## Write-set
`.agent-notes/` and `plans/fix-nan-a2-retire/decision-journal.md` only.

## Read-set
- `test/corpus/_?` per-element compare recipe in
  `.agent-notes/b15-per-entry-run-routing.md` (childCount blindness note)
- T3's commit diff

## Acceptance criteria
- Given each watch graph, when byte-compared pre/post-T3, then identical OR
  every difference is toward the oracle with a stated mechanism.
- Given the NaN ids, when per-element compared vs oracle, then 0/0 on all 3.

## Observability / Rollback
N/A. Reversible (notes only).

## Commit
`docs(T4): watch-graph gate results for NaN endpoint fix` (only if notes
were produced; otherwise fold the journal row into T3's commit).
