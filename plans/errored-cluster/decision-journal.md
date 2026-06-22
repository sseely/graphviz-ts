<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision Journal

Appended during execution. Every non-trivial judgment call gets a row.

| Date | Batch/Task | Decision | Rationale |
|------|------------|----------|-----------|
| 2026-06-22 | planning | scope = 8 errored cases, 4 root causes (RC1 flatReorderRank ×3, RC2 mapPathLongSingle ×2, RC3 buildSkeletonEdgeCounts ×1, RC4 Stripper string-strip ×2) | pre-investigated via real inner stack traces |
| 2026-06-22 | planning | RC4 is the pre-parse `validateEdgeOperators` heuristic, NOT the peggy grammar (`dot.js` parses big.gv/biglabel.gv fine) → fix `Stripper.strip`, no dot.js regen | confirmed by parsing both files standalone |
| 2026-06-22 | planning | baseline parity (post arrowhead-geometry, dot 15.1.0): byte-match 249, structural 222, diverged 288, errored 13, timeout 9, oracle-error 15 | pre-flight reference for the B3 regression diff |
| 2026-06-22 | B1/T1 | RC4 fix = change rQ regex `\\.`→`\\[\\s\\S]` in `Stripper.strip` so a `\<newline>` continuation (and any `\<char>` escape) cannot break the string match; interior `--`/`->` blanked | matches scan.l qstring rules (`\"`,`\\`,`\<newline>`); blankQ preserves length so findEdgeOp offsets stay aligned |
| 2026-06-22 | B1/T1 | colocated test uses synthetic big.gv-style inputs (not fs reads of ~/git/graphviz) for the unit test; verified real big.gv/biglabel.gv render SVG out-of-band via renderSvg | keeps the browser-targeted unit test self-contained; B3 survey regen is the real corpus proof |
| 2026-06-22 | B1/T1 | gates green: typecheck 0, vitest 2247 pass (+6), build 0. big.gv→44609B svg, biglabel.gv→17599B svg (were EDGE_OP_UNDIRECTED_IN_DIRECTED). committed 6d54892 | B1 complete |
