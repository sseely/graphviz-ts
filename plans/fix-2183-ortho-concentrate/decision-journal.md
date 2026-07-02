<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

| date | batch/task | decision / finding |
|---|---|---|
| 2026-07-02 | setup | Branch fix/2183-ortho-concentrate from main (314d31d). Starting Batch 1: T1 (lost edges), T2 (cluster labels), T3 (delta attribution). Main-loop sequential per D4. |
| 2026-07-02 | B1 GATE | SINGLE ROOT CAUSE for all 3 symptom classes: infuseAllNodes (conc.ts) feeds infuseEdgeChain fast-graph out-edges where C's rebuild_vlists walks ORIGINAL cluster out-edges (conc.c:146) → chain vnodes never infused → cluster_A rank 9 leaderless → dotConcentrate -1 → dotPosition EARLY RETURN → x never solved (137pt vs 385pt), cluster bbs degenerate, labels unplaced, ortho maze from garbage coords → degenerate 3-node paths → a->b/o->r lost. Evidence + ruled-out: .agent-notes/2183-concentrate-cluster-abort.md. T3: all deltas class (a) downstream. |
| 2026-07-02 | B1 GATE | WRITE-SET RE-SCOPE: fix locus = src/layout/dot/conc.ts (+ test), superseding provisional ortho-adapter.ts/device-cluster.ts (1213-precedent pattern). Secondary observation logged (fillRankVlist detached slice vs aliasing convention) — not fixed without evidence. |
