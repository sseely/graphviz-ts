<!-- SPDX-License-Identifier: EPL-2.0 -->
# F1 — 1949 (diagnosed+fixed 2026-07-05) — CONFORMANT: makefwdedge lead normalization + stale aux arrow attrs

Two discriminators, both C-instrumented (DBGFLAT in dotsplines.c):

## 1. Missing makefwdedge lead-edge forward-normalization
C make_flat_edge (dotsplines.c:1515-1518; setflags:518 BWDEDGE =
ND_order(tail) > ND_order(head)) normalizes edges[0] so the LEAD PAIR'S
TAIL IS ALWAYS THE LOWER-ND_order ENDPOINT before make_flat_adj_edges.
1949's structDefaultAuto->structParty:N (order 1→0) is a lone all-backward
group after R7's getmainedge split; C normalizes → the aux clone is a
FORWARD rank0→rank1 edge (eflag=1, del=(0,510.154)). Port used edges[0]
raw → mirrored auxt/auxh → aux back-edge → faithful route declines →
fitter draws truncated :N spline + wrong del frame. THE FEARED 241_0
CONFLICT DISSOLVED: 241_0's cnt=3 group already leads forward
(normalization no-op); no clipAndInstall sflag/eflag change needed —
T10b's normalizeCopiedFlatSpline already covers the :S quirk.

## 2. Stale-symbol arrowsize in the aux (load-bearing C quirk)
Inside the aux graph, agxget(auxe, E_arrowsz) returns "black"/"blue" — the
COLOR values: cloneGraph re-declares the aux dictionary via agnxtattr
(name-sorted ids) while E_arrowsz keeps its main-graph declaration-order id
(setState never remaps E_arrowsz/E_penwidth). arrow_length's late_double
strtod fails → arrowsize=1.0/penwidth=1.0 → aux backoff 11.48 vs the
port's correctly-resolved 8.48 = the exact Δ3/Δ2.72 curve gap. Arrow
POLYGON unaffected (C regenerates at emit from the original edge).
Bounded replication: EdgeInfo.stale_arrow_attrs (pre-declared, hidden-class
safe) set by cloneEdge (flat-adj-aux only), consumed by clipArrowsize/
clipPenwidth at the 3 clip-length callsites (splines-clip.ts:134/160/246);
arrow-op generation untouched.

## Validation
1949: 33 diffs/maxΔ36.67 → 0 CONFORMANT. 241_0 (kill criterion) byte-
identical conformant. 241_1/2368/1332/2413_1/2413_2/graphs-decorate all
byte-identical. vitest 2685 green (+2 regression tests pinning both
discriminators). tsc clean.

Commit b51dab5 (5 files, +136/−16) on its worktree branch.
C-cleanup verified: dotsplines.c reverted, plugin rebuilt, 1949+241_0
oracle renders byte-identical to cache; dot binary never rebuilt.
