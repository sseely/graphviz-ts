# Decision Journal

Appended during execution. Every non-trivial judgment call gets a row.

| Date | Batch/Task | Decision | Rationale |
|------|------------|----------|-----------|
| 2026-06-21 | planning | plans/ NOT gitignored | project tracks mission briefs as committed artifacts (existing convention); skip the global skill's gitignore step |
| 2026-06-21 | planning | baseline green: typecheck + build exit 0, 2090 tests pass (156 files) | pre-flight before execution |
| 2026-06-21 | planning | branch feature/expose-library-api created; brief committed (d689e5b) | mission start |
| 2026-06-21 | Batch 1 | execution plan: T1/T2/T3 are independent (disjoint write-sets: gvc/default-context, api/edge-ops, api/geometry) → 3 parallel typescript-pro agents | parallelism rule: independent files, no shared writes |
| 2026-06-21 | Batch 1 / T2 | finding: parser processEdgePair (builder.ts:233) does NOT dedup strict edges; T2 strict-dedup follows cgraph agedge semantics, not a parser port | verified against live tree; recorded in .agent-notes for the T2 agent |
| 2026-06-21 | pre-existing | scratch/debug files (debug-*.ts, *-probe.ts, edge-route-fwd.ts, *.scratch.test.ts, *.mjs) carry stale TS errors but are excluded from `tsc --noEmit` (gate passes); not in any write-set | logged per pr-workflow; out of scope |
| 2026-06-21 | Batch 1 / T1 | createDefaultContext: 8 engines + 11 renderers; 21 tests; commit 74b6b14 | done |
| 2026-06-21 | Batch 1 / T2 | addEdge: strict-dedup follows cgraph agedge wildcard probe (id=0,objtype=0; symmetric for undirected); name irrelevant to dedup gate; 12 tests; commit 40617c4 | done |
| 2026-06-21 | Batch 1 / T3 | getLayout snapshot: width/height inches→points (×72); bezier points use bz.size not list.length; 13 tests; commit 2683f48. Agent left files uncommitted (blocked on lizard complexity hook); orchestrator finished residue inline after verifying tsc+test green | done; known subagent hook-loop pattern |
| 2026-06-21 | Batch 1 gate | PASS: git diff shows only the 6 write-set files; 2136 tests pass (159 files, +46); build exit 0; typecheck exit 0 | gate between batches |
| 2026-06-21 | Batch 2 / T4 | builder: KIND_TABLE mapping; handles wrap internal refs (ADR-1); subgraph addNode via agsubnode; 20 tests; commit 518e3d6 | done |
| 2026-06-21 | Batch 2 / T5 | render(): createDefaultContext→layout→deviceRender→freeLayout; SVG byte-parity vs renderSvg confirmed; yAxis NOT threaded (ADR-5, getLayout concern); 9 tests; commit 2ec3627 | done |
| 2026-06-21 | Batch 2 / T6 resolution | user decision: "Defer xdot fix; finish mission". T6 wrapper committed (d457615) with documented limitation + test asserting only the working node shape/text/font/color ops (5 tests); xdot-renderer fix scoped to a follow-on T11 will scaffold | per user; mission continues |
| 2026-06-21 | Batch 2 gate | PASS: git diff (src) = only the 6 write-set files; 2170 tests pass (162 files, +34); build exit 0; typecheck exit 0 | gate between batches |
| 2026-06-21 | Batch 2 / T6 | **STOP — capability gap.** getDrawOps wrapper is correct (thin: layout→render xdot→parseXDot→flat XdotOp[], option b). But the underlying XDOT RENDERER (src/render/dot.ts createXdotRenderer) is integration-incomplete: (1) edges emit NO `_draw_` at all; (2) node pen color ignored (color=red → #000000, native → #ff0000); (3) node `_draw_` ellipse coords swapped between nodes. Oracle `dot -Txdot` confirms correct output. TS SVG renderer DOES draw the edge + apply red, so geometry is computed — only the xdot emission path is broken. Existing dot.test.ts covers xdot HELPERS only (xdotPenColor etc.), never a full-graph xdot render, so the gap was untested. T6 acceptance criteria (edge ops, color ops) cannot pass without fixing the renderer, which is outside every task write-set and the mission's additive premise. Hits brief stop condition: "a capability is not externalizable as assumed." T6 wrapper left uncommitted (src/render/xdot-public.ts, no test yet) pending user decision on scope. | STOP per autonomous protocol; awaiting human input |
