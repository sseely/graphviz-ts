<!-- SPDX-License-Identifier: EPL-2.0 -->
# F2 — 2620 (diagnosed 2026-07-05) — FIX: mincross transpose gates, not position

mechanism: transposeCounts (src/layout/dot/mincross-cross.ts:165, called
from transposeStep :222) accumulates BOTH in- and out-crossings
unconditionally; C transpose_step (mincross.c:632, gates at :646-652) adds
in_cross only when r > 0 and out_cross only when GD_rank(g)[r+1].n > 0 —
for clusters, allocate_ranks (mincross.c:1163) callocs maxrank+2 slots, so
the slot past the cluster's maxrank has n==0 and C IGNORES out-crossings at
the cluster's bottom rank (its downward exit edges). The port counted them
→ 20 extra swaps at clustercrm r=3 (first divergent scalar: iter-0 ncross
C=4227 vs port=4191) → cluster-internal order diverges → remincross spreads
it → 78/237 glyphs shift along the within-rank axis (all dx=0, rankdir=LR;
±54-pitch block multiples + cluster-box knock-ons incl. the ±898s).
Ironically the C-side flavor of the over-allocated-list class: C READS its
calloc'd n=0 slot as a gate.

ruledOut (paired dumps, 0 diffs each): rank assignment (dx=0 everywhere);
component mincross/merge2; clusters 1-11; expand_cluster/breakcycles/
flat_reorder for clustercrm; medians+reorder at the divergent iteration
(divergence strictly inside transpose); ortho as dominant cause (divergence
exists at mincross exit — confirms R4 split).

verdict: FIX — two-line gate, worktree-validated: 2620 node census 78→0;
compareSvg 5116 diffs/maxΔ3207 → 423/maxΔ585; 253/253 cluster-containing
conformant dot cases re-rendered vs live oracle: zero regressions.
Residual 423/585 is now PURELY edge-path (ortho) — first time measurable
since the maze input matches; separate follow-on diagnosis.

proposedWriteSet (→ F5): mincross-cross.ts transposeCounts(v,w,useIn,
useOut) + transposeStep passes (r>0, (rank[r+1]?.n ?? 0)>0); test updates
(3 call sites) + gate test. JSDoc @see mincross.c:646-652 + allocate_ranks
over-allocation.

C-cleanup verified: dotinit.c + mincross.c reverted, plugin rebuilt, 2620
oracle byte-identical via BOTH /tmp/gvplugins and /tmp/ghl; dot binary
never rebuilt; sibling dotsplines.c instrumentation (F1) left intact.
