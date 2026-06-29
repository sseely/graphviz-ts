<!-- SPDX-License-Identifier: EPL-2.0 -->
# T0 — Diagnose the exact addTreeEdge order divergence

## Context
graphviz-ts is a faithful C→TS port; `~/git/graphviz` is the spec. The x-coord
network simplex builds a tight spanning tree whose `Tree_edge` LIST ORDER drives
`LR_balance`'s degenerate-rerank sequence. That order diverges from C (root cause
pinned — read `.agent-notes/b51-blok60-is-xcoord-ns-selection.md` first). The port
uses the modern subtree-heap `tight_tree` (`feasibleTree` →
`findTightSubtree`/`interTreeEdgeSearch`/`stExtractMin` in `ns-subtree.ts`,
`addTreeEdge` in `ns-core.ts`).

## Task
Find the FIRST point where the port's `addTreeEdge` call ORDER diverges from C's
`add_tree_edge` order, for the x-NS pass (balance=2) on share-b51, and identify the
exact C rule (DFS/scan order, heap `stExtractMin` tie-break, or `inter_tree_edge`
selection) that produces C's choice.

## Read-set
- `.agent-notes/b51-blok60-is-xcoord-ns-selection.md` (root cause + prior probes)
- C: `~/git/graphviz/lib/common/ns.c` — `feasible_tree`, `tight_tree`,
  `find_tight_subtree`, `tight_subtree_search`, `inter_tree_edge`,
  `inter_tree_edge_search`, `add_tree_edge`, `merge_trees`, the subtree heap
  (`STsize`/`tree_node`/`extract_min`)
- Port: `src/layout/dot/ns-subtree.ts` (whole), `ns-core.ts:addTreeEdge` (70),
  `ns-range.ts:dfsRange`

## Method (paired instrumentation — the proven technique)
1. Instrument C `add_tree_edge` (ns.c): gated `getenv("XNSDBG")` + balance/x-NS,
   `fprintf` a monotonic counter + the edge identity (agtail/aghead `agnameof`, or
   `ND_lim` once assigned, or a stable order index). Rebuild headless oracle:
   `touch lib/common/ns.c && make -C build gvplugin_dot_layout`; refresh
   `sh test/corpus/gen-headless-gvbindir.sh`.
2. Instrument port `addTreeEdge` (ns-core.ts) the same way (XNSDBG env).
3. Render share-b51 both ways:
   - C: `XNSDBG=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/share/b51.gv`
   - port: `XNSDBG=1 GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/share/b51.gv dot`
4. Diff the two add-order sequences; locate the first differing add. Inspect the C
   decision at that step (which subtree/edge it picked and why) vs the port's.
5. **Revert ALL probes** (C `git checkout lib/common/ns.c` + rebuild; port
   `git checkout` the instrumented file) before finishing. Leave the tree clean.

## Acceptance (Given/When/Then)
- Given share-b51 x-NS, when comparing C vs port `addTreeEdge` order, then the
  first divergent add is identified (index + both edges' identities).
- Given that divergence, when the C code path is read, then the exact C rule
  (named function + the specific comparison/iteration) that yields C's pick is
  documented.
- Given the finding, then Batch 1's write-set is named precisely (which of
  `ns-subtree.ts` / `ns-core.ts` / `ns-range.ts`, which function).

## Output (interface for T1)
Append to `.agent-notes/b51-blok60-is-xcoord-ns-selection.md`:
`{ divergentAddIndex: number, cEdge, portEdge, cRule: "<fn + comparison>",
   fixTarget: "<file>::<function>" }`.

## Boundaries
- **Never** leave instrumentation in C or port (both must be `git diff`-clean).
- **Ask first** if the divergence is NOT in the subtree-merge (e.g. it traces to
  `dfsRange` lim numbering or `createAuxEdges` aux-edge order) — that changes scope
  (stop condition).
- Do not edit any port logic in this task — diagnosis only.

## Observability / Rollback
N/A — diagnostic task, no runtime behavior, no commit beyond the agent-note.

## Quality bar
Return only the structured finding (the Output block) + the one-line fixTarget.
No code changes committed except the agent-note.
