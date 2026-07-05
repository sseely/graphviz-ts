<!-- SPDX-License-Identifier: EPL-2.0 -->
# T18 — NS degenerate-optimum class (diagnosed 2026-07-05) — CLASS EMPTY; 2521 = mincross scratch FIX

**headline**: none of the three targets diverges in NS optimum selection.
Paired env-gated instrumentation (C ns.c vs port ns*.ts) on 2521: init ranks,
every add_tree_edge, every merge_trees side-selection, post-failure ranks for
all 27 aux nodes — BYTE-IDENTICAL (diff of paired logs empty). Tree_edge/
LR_balance never even execute (both x-NS rank2 calls fail feasible_tree=1
identically).

**2521 (Δ7) mechanism**: mincross save_best scratch semantics. C saveorder(v)
stores WINDOW-RELATIVE order (install_in_rank ND_order=i per component
window); port saveBest stored ABSOLUTE order (vStart+i). Node b3 is dropped
from the rank arrays by BOTH sides (allocate_ranks undercount → install at
slot an → merge2 truncation — C's load-bearing buffer overflow, faithfully
replicated) so the leftover scratch IS its final x: port 7 vs C 0 → cx 33 vs
26. origin: src/layout/dot/mincross-order.ts:157/:166 vs C mincross.c:114/
781/764/1176/1157/817.

**verdict**: fix (prototyped: saveBest stores order−vStart, restoreRank adds
vStart back; net no-op for undropped nodes; ns*.ts hot loops untouched).
2521 → conformant; 2368/1447_1/2371/b51/unix byte-identical pre/post; tsc
clean; 2672 tests. Fix committed on branch t18-ns-diagnose.

**re-attributions** (follow-ups): 1447_1 = ortho maze-corridor family
(2620-class), NOT NS — 280 diffs all edge @d, zero node diffs. 2371 = 2-edge
spline-shape residual (g[9263], g[23859], mirrored waypoints), NOT NS —
memory note 2371-is-xcoord-ns-solution-selection is STALE. The
xcoord-NS-selection bucket is retired.

**environment**: C tree reverted (only user .gitignore mod), plugins rebuilt
clean + byte-verified, dot binary never relinked (oracle cache sig intact).
