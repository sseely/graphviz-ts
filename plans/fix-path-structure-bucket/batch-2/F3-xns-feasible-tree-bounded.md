# F3 — BOUNDED attempt: feasibleTree construction-order conformance (x-NS family)

RUNS SEQUENTIALLY, LAST in Batch 2 (D2: NS-core — nothing else may run in
parallel; own commit; full survey immediately after).

## Context (read .agent-notes/path-structure-xns-residuals.md fully first)
T4 proved graphs-b51's Δ1096 (blok_16) originates in the PRIMARY rank NS for
cluster_if_40's 7-node/7-edge local ranking (balance=0, so no TB_balance):
C's feasible tree is 0-pivot optimal; the port's feasibleTree builds a
STRUCTURALLY different spanning tree (same initial ranks, different
tree-edge set → different cutvalues → one extra cost-neutral pivot →
blok_16 lands on a different equal-cost rank). All NS inputs (weight,
minlen, lw/rw, omega) verified faithful. Same shared-core mechanism behind
1447 (T3), 2475_2, share-b51/blok_60, 2371. The 7-node subgraph is a fully
observable minimal repro.

## Task (bounded)
1. Paired dump on the 7-node cluster_if_40 call: port `tightSubtreeSearch`/
   `interTreeEdgeSearch` edge-add sequence (env-gated XNSDBG in
   ns-subtree.ts) vs C `tight_subtree_search`/`inter_tree_edge_search`
   (ns.c) traced ANALYTICALLY (hand-execute the C code on the 7-node input —
   it is small enough; no C edits). Identify the FIRST tree-edge choice
   where the port departs and WHY (iteration order of a node's edge list?
   tie in slack? search start node?).
2. If the departure is a pinnable faithfulness divergence (port iterates a
   different edge order / different start / different tie handling than the
   C code specifies), fix THAT at its origin, minimally.
3. Verify: blok_16 rank matches C on graphs-b51; then check 1447 and
   share-b51 stay/become correct; run `npm run test`; commit alone; then
   IMMEDIATELY `npm run survey && npm run survey:gate` (full corpus).
   Any per-id verdict regression → `git revert` the commit, document, stop.

STOP CONDITIONS (hard):
- The port's traversal already matches the C code's specified order and the
  tree difference arises from something not expressible as a local
  faithfulness fix (e.g. dict/iteration-order substrate) → document
  tracked-deep evidence in the note, no fix.
- The fix would need to touch anything beyond `ns-subtree.ts` (+ its test)
  → stop and report.
- 3 attempts at the same location without blok_16 conforming → stop.

## Write-set
- `src/layout/dot/ns-subtree.ts` (+ colocated test)
- `.agent-notes/path-structure-xns-residuals.md` (append outcome)

## Read-set
- `.agent-notes/path-structure-xns-residuals.md`,
  `.agent-notes/b51-blok60-is-xcoord-ns-selection.md` (T0 add-order dump
  method — build phase was identical, merge phase is where picks differ)
- C: `~/git/graphviz/lib/common/ns.c` (feasible_tree, tight_subtree_search,
  inter_tree_edge_search, init_cutvalues)
- Port: `src/layout/dot/ns-subtree.ts`, `ns.ts::rank2`

## Repro
```
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/graphs/b51.gv -o /tmp/gb51.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/b51.gv dot > /tmp/gb51.port.svg
node test/diagnostic/flat-geom-diff.mjs /tmp/gb51.c.svg /tmp/gb51.port.svg
```
Bash allowlist: first token one of node, npx, npm, git, python3, ls, cat,
grep, find, head, tail, wc, sort, diff, mkdir, cp, mv. NEVER `cd`-prefix;
scripts to files, never `node -e`.

## Acceptance criteria
- Given graphs-b51, when the 7-node call runs post-fix, then blok_16's rank
  equals C's and the pivot count is 0 (matching C's `-v2` `0 iter`)
- Given the full survey post-commit, then ZERO per-id verdict regressions;
  graphs-b51 improves; watch 1447/2475_2/2371/share-b51 for movement
- Given `npm run test` + `npx tsc --noEmit`, then exit 0

## Additional watch ids (same mechanism class, confirmed by T1/D6)
- 2521 — NS resolution of a CONTRADICTORY constraint pair
  (.agent-notes/path-structure-rank-extent.md Block 1)
- 2239 — LR_balance slack redistribution over the divergent spanning tree
  (.agent-notes/2239-cluster-rank-axis.md; worst cluster C=4507pt vs
  port=158pt — port is the MINIMAL feasible point, C's balance spreads slack)
Both may move (either direction) when tree construction changes — record
their before/after deltas explicitly.

## Observability: N/A. Rollback: Reversible — single commit
`fix(ns): <mechanism> (F3)`, revert on any survey regression.
