<!-- SPDX-License-Identifier: EPL-2.0 -->
# R3 — 1453 TREE_GROUP Δ457 (diagnosed 2026-07-05) — FIX (verified 0-diff)

mechanism: mediansProcessNode (mincross-order.ts:114-122) fuses C medians'
TWO loops into one and early-returns into flatMval for nodes with no fast
edges — skipping C's unconditional `case 0: ND_mval(n) = -1` reset
(mincross.c:1621-1685, case 0 at :1643, separate flat_mval loop
:1673-1677). When flat_mval declines (neighbor mval < 0), C leaves the
fresh −1; the port leaves the STALE mval from the previous pass direction.

causalChain: rank-2 cluster row `MH2 CM CM1 CM2 TG`; CM* have only flat
edges. Down-pass both sides: MH2=0, chain CM=1/CM1=2/CM2=3 via flat_mval,
TG=−1. Up-pass: C resets all to −1 (flat_mval fails, stays −1; only TG=0
comparable → no swap). Port: CM* retain stale 1/2/3, TG=0 → reorder sees
CM2(3)>TG(0), rev=1 → exchange → TG bubbles 4→3→2→1 over remincross
up-passes → save_best locks TG_ord=1 (C locks 4) → TREE_GROUP dx=−457,
CONTEXT_* dx=+123, graph-wide −1pt fallout (~489 diffs).

ruledOut (paired instrumentation, C via /tmp/gvplugins): rank/UF leaders
(byte-equivalent probes); class2 classification (identical traces);
flat_breakcycles/flat_reorder (identical orders); left2right flat-matrix
(identical decisions — port swaps were legal by C's own guard); transpose
(all watched pairs c0=c1=0 both sides); dedupByOrig (already fixed 5f368d9).

verdict: FIX — experimentally confirmed: env-gated two-loop restructure in
the worktree → 1453 = 0 diffs, compareSvg PASS deterministic; all 25 paired
nodes Δ0.00. Controls: 2368 unchanged (accepted hypot family), 1332 stays 0.

proposedWriteSet (→ R8): src/layout/dot/mincross-order.ts — restructure
medians into C's two loops (loop 1 resets/sets EVERY node's mval; loop 2
runs flatMval only for edge-less nodes); mediansProcessNode reduces to the
loop-1 body; flatMval untouched. + mincross-order.test.ts regression (stale
mval must read −1 when flatMval declines). BONUS: same fix corrects a
latent fusion defect — flatMval's flat_out branch reads the RIGHT
neighbor's mval, fresh post-loop-1 in C but pre-update stale when fused.

Cleanup verified: C tree (class2.c, mincross.c, cluster.c, rank.c) reverted
+ plugin rebuilt + oracle byte-verified (cmp clean); dot binary untouched.
