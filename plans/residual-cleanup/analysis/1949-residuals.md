<!-- SPDX-License-Identifier: EPL-2.0 -->
# R2 — 1949 residuals (diagnosed 2026-07-05) — FIX ×2

## (a) cluster-owned label-vnode flip (Δ2.58/5.43 on 4 edge-label text/@y)
virtualNode(g) (fastgr.ts:346-349) binds n.root = g — the CLUSTER subgraph —
violating cgraph's invariant (node.c:83 n->root = agroot(g)). Cluster
subgraphs never get info.flip populated (initSubgraphRankdir runs Phase 0,
clusters register during ranking) → placeVnlabel (splines-label.ts:67-78)
reads flip=falsy for cluster-owned label vnodes → labelXPos uses dimen.x not
dimen.y → error = (dimen.x−dimen.y)/2, matching BOTH observed deltas exactly
(20.4531,9.6)→5.4266; (4.4453,9.6)→−2.5773. C-instrumented place_vnlabel:
GD_flip(agraphof(n))=1 for all 7 vnodes incl. the 4 cluster-owned.
ruledOut: placement formula (line-faithful); vnode coords (uniform +8 both
sides, cancels).
FIX OPTIONS: broad = fastgr.ts virtualNode binds dotRoot(g) (the faithful
invariant; larger blast radius); narrow = splines-label reads
dotRoot(n.root).info.flip. ORCHESTRATOR DECISION: broad-first (mechanism at
origin per diagnosis.md), fall back to narrow if the batch gate regresses.

## (b) side-port adjacent-flat aux grouping (≤3pt first-segment, 2 edges)
collectAdjacentFlatGroup (edge-route.ts:318-324) groups by unordered node
pair; C (dotsplines.c:343-378, :356 le0!=le1 break) groups by getmainedge —
so C makes TWO independent cnt=1 aux solves (dels (0,510.154) and
(−45.37,510.154)) where the port makes ONE shared cnt=2 aux
(del (−61.486,518.154)). Same getmainedge-not-node-pair discriminator T10b
established for the no-port grouping. ruledOut: HTML port sizing (N/S port
boxes byte-identical both sides, both instances); T10b's cloneNode fixes
(node sizes match exactly).
FIX: restrict grouping to same-getmainedge (edge-route.ts). MANDATORY
co-validation: 241_0 (prior regression site), plus every side-port
adjacent-flat corpus id.

verdicts: fix + fix. Cleanup verified: C reverted + plugin rebuilt +
byte-diffed clean; TS worktree reverted + byte-diffed clean; dot binary
never touched.
