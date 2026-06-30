<!-- SPDX-License-Identifier: EPL-2.0 -->
# T0 — Diagnose the ldbxtried X-coordinate / ordering divergence

## Context
graphviz-ts is a faithful C→TS port; `~/git/graphviz` is the spec. On
`graphs/ldbxtried.gv` (a clustered graph, `cluster0` "toucan") the port
mispositions 13 of 32 nodes in **X only** (every cy/rank matches) and reorders at
least one node within its rank. Counts + bbox match (60 nodes, 70 edges, viewBox
1111×628), so this is pure horizontal geometry. The 48 diverged edges (mostly
point-count) are downstream of the moved endpoints.

## Pinned signatures (start here)
- Node X deltas (cy identical in each): **n454** C 772.89 / port 449.89 (Δ323);
  **n449** C 543.89 / port 753.89 (Δ210); **n518** C 642.89 / port 439.89 (Δ203);
  n526 Δ60, n513 Δ60, n500 Δ52, n496 Δ52, n474 Δ16, …
- Within rank y=−38, L→R order: **C `n526,n513,n518`** vs **port
  `n518,n526,n513`** — n518 moves rightmost→leftmost. Decide first whether this
  is a true reorder (mincross) or an x-coord shift large enough to cross.

## Task
Find the FIRST stage where the port's horizontal layout of ldbxtried diverges
from C, and name the exact C rule + the port locus to fix. Determine which layer:
1. **Cluster mincross ordering** — does the within-rank L→R node order (incl.
   cluster nodes + virtual nodes) match C? (a reorder → x-coord follows)
   `mincross.c` cluster path vs `mincross*.ts` / `mincross-cluster*.ts`.
2. **X-coordinate network simplex** — given identical order, do node x-coords
   differ? `position.c` / `ns.c` (x-NS, `LR_balance`) vs `position.ts` / `ns.ts`.
3. **Cluster containment / margin** — does cluster x-extent / contain_nodes /
   margin push nodes? `cluster.c` vs `position-cluster.ts`.

## Read-set
- Prior art: `[[2471-blocker-is-cluster-ranking]]`,
  `[[cluster-layout-fixes-done]]`, `[[contain-nodes-vstart-window]]`,
  `[[hang-2475-2-xcoord-ns]]`, `[[xcoord-ns-lrconstraints-int-trunc-done]]`,
  `[[ns-hotpath-ninfo-slowmode]]`. Mission `../fix-graphs-mike/` (a rank-phase
  sibling; same instrumentation recipe).
- C: `~/git/graphviz/lib/dotgen/mincross.c` (cluster ordering: `mincross_clust`,
  `build_ranks`, `install_in_rank`, the `medianvalue`/`reorder` pass),
  `lib/dotgen/position.c` (`set_xcoords`, `make_aux_edge`), `lib/common/ns.c`
  (`rank2`, `LR_balance`), `lib/dotgen/cluster.c`.
- Port: `src/layout/dot/mincross*.ts`, `src/layout/dot/position*.ts`,
  `src/layout/dot/position-cluster.ts`, `src/layout/dot/ns.ts`.

## Method (paired instrumentation — proven recipe)
1. Instrument C: gated `getenv("LDBG")`, dump for ranks/nodes around the affected
   set (n518/n454/n449/n526/n513) the within-rank node ORDER (ND_order, L→R) and
   each node's ND_coord.x, at the END of mincross and again after x-coord. Rebuild:
   `cd ~/git/graphviz/build && make dotgen && make gvplugin_dot_layout && cp -f
   plugin/dot_layout/libgvplugin_dot_layout*.dylib /tmp/ghl/`.
2. Instrument the port the same way (LDBG env) at the matching points.
3. Render both:
   - C: `LDBG=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/graphs/ldbxtried.gv`
   - port: `LDBG=1 GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/ldbxtried.gv dot`
4. Compare order-by-rank first (is it a reorder?), then x-coords; locate the
   first divergence; read the C decision there vs the port's.
5. **Revert ALL probes** (C `git checkout` + rebuild; port `git checkout`) before
   finishing. Leave both trees `git diff`-clean; regenerate a clean oracle with
   `sh test/corpus/gen-headless-gvbindir.sh`.

## Acceptance (Given/When/Then)
- Given ldbxtried, when C vs port horizontal layout is compared, then the first
  divergent stage is identified (cluster-mincross-order | x-coord-NS |
  cluster-containment) with both values for the affected nodes.
- Given that divergence, when the C path is read, then the exact C rule (named
  fn + comparison/loop) producing C's result is documented.
- Given the finding, then Batch 1's write-set is named precisely
  (`<file>::<function>`).

## Output (interface for T1)
Append to `.agent-notes/ldbxtried-xdivergence.md`:
`{ divergentStage: "cluster-mincross-order|x-coord-NS|cluster-containment",
   cValue, portValue, cRule: "<fn + comparison>", fixTarget: "<file>::<function>" }`.

## Boundaries
- **Never** leave instrumentation in C or port (both `git diff`-clean at finish).
- **Ask first / stop** if the divergence is NOT in ordering / x-coord / cluster —
  e.g. it traces to rank assignment (Y) or edge-spline routing only. That changes
  scope.
- Diagnosis only — no port logic edits in this task.

## Observability / Rollback
N/A — diagnostic task, no runtime behavior, no commit beyond the agent-note.

## Quality bar
Return only the structured finding (the Output block) + the one-line fixTarget.
No code changes committed except the agent-note.
