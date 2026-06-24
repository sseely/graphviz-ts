<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal — fix 2-cycle back-edge

| timestamp | batch/task | decision | rationale |
|---|---|---|---|
| 2026-06-24 | scoping | Root cause = handleBackEdge iterates fast graph not original cgraph edges | Traced minimal repro digraph{a->b;b->a}: after class2 node a has a→b(w1)+a→b(w2); C has one a→b(w2). C uses agfstout (original); port outEdges helper returns n.info.out (fast). Fast edge opp has to_virt undefined → makeChain(opp) duplicates. |
| 2026-06-24 | scoping | Candidate fix proven before writing brief | Changed handleBackEdge to e.head.outEdges(g): minimal repro byte-matches; NaN max disp 1784→43, median 691→0; typecheck clean. Reverted (scoping only). |
| 2026-06-24 | T1 | Applied fix + removed dead outEdges helper; tests via renderSvg | Golden uses a fix-sensitive 2-cycle (shifts 20pt without fix) + a 3-cycle sanity, both oracle-pinned to dot 15.1.0 -Tsvg. typecheck 0; npm test 2375 green; lizard clean. |
| 2026-06-24 | T1 | CORRECTION: no global-state leak — earlier "leak" note was a misdiagnosis | The original test failure ("expected 54 to be 27") was a WRONG 3-cycle assertion (I assumed x-alignment; the back edge pushes b left to 27 while a sits at 54), NOT dotLayoutPipeline leaking. Verified: a probe asserting e.x===27 via dotLayoutPipeline passes both isolated AND in the full suite; and dotLayoutPipeline gives byte-identical coords even after polluting with LR/cluster/2-cycle graphs (Rankdir, reMincross, fillSeq all set-before-read per pass; dot uses no PRNG). dot layout is fully deterministic and does NOT depend on renderSvg for correctness. The renderSvg-based test is kept because it pins the public end-to-end path against the -Tsvg oracle, not because of any leak. |
