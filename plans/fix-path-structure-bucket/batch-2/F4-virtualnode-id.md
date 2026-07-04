# F4 — virtualNode id=0 faithfulness fix (1718 candidate mechanism)

RUNS after F1/F2/D5 complete (needs a clean tree for its survey). Broad
tie-break blast radius → D2-style gating: own commit + immediate full survey.

## Context (read .agent-notes/path-structure-rank-extent.md Block 2 first)
`src/layout/dot/fastgr.ts:348` `virtualNode(g)` does `new NodeClass(0,'',g)`
— hardcodes id 0 for EVERY virtual node. C's `virtual_node()`
(`~/git/graphviz/lib/dotgen/fastgr.c`) mints a fresh, unique, monotonically
increasing id for every virtual node (same sequence real nodes use). Any
`.id`-based tie-break between two virtual nodes (ufUnion's `u.id > v.id`,
id-based sorts/dict orders) gets a constant outcome in the port vs a real
creation-order-dependent outcome in C. This is a confirmed faithfulness
defect regardless of 1718; it is the best CANDIDATE mechanism for 1718's
Δ3716 rank-axis height divergence (256-node grid, many virtual chains from
long back edges; rank count/bucketing already verified identical — the
divergence is per-rank SPACING).

## Task
1. Read C's `virtual_node()` in `~/git/graphviz/lib/dotgen/fastgr.c` and
   determine the exact id semantics (which counter, shared with real nodes
   or not — trace `agnode`/sequence usage). Mirror it exactly in
   `virtualNode()` (check how real-node ids are minted in the port and
   whether virtual nodes must share that sequence to be faithful).
2. Fix, with JSDoc `@see dotgen/fastgr.c:virtual_node`.
3. Measure 1718: render+flat-geom-diff before/after (expect height
   21192-class if this is the mechanism; report either way — a faithfulness
   fix that doesn't close 1718 still lands if the survey is clean, per the
   prior edgeLen precedent).
4. `npm run test` + `npx tsc --noEmit`.
5. Commit alone: `fix(dot): virtual nodes get unique sequential ids (F4)`.
6. IMMEDIATELY run `npm run survey && npm run survey:gate` — zero per-id
   verdict regressions required; any regression → `git revert`, document,
   stop.

## Write-set
- `src/layout/dot/fastgr.ts` (+ colocated test if one exists for virtualNode)
- `.agent-notes/path-structure-rank-extent.md` (append F4 outcome to Block 2)

## Read-set
- `.agent-notes/path-structure-rank-extent.md` Block 2
- C: `~/git/graphviz/lib/dotgen/fastgr.c` (virtual_node), cgraph node-id
  minting if referenced
- Port: `src/layout/dot/fastgr.ts`, real-node id minting site

## Acceptance criteria
- Given any two virtual nodes, when created, then their ids are unique and
  ordered by creation (matching C semantics exactly)
- Given the full survey post-commit, then zero per-id verdict regressions
- Given 1718, then its before/after delta is measured and recorded in the
  note (improvement not required for landing; survey cleanliness is)

## Observability: N/A. Rollback: Reversible — single commit, revert on
survey regression.
