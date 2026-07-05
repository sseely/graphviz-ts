<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — ortho 2361 + 1856 (diagnosed 2026-07-04, agent-verified) — FIX ×2, tie-break theory REFUTED

## Mechanism 1 — 2361 (Δ144): int truncation in sgraph Dijkstra relax
C accumulates path cost in an int (snode.n_val, sgraph.h:27; relax at
sgraph.c:165 `d = -(N_VAL(n)+E_WT(e))` truncates toward zero per step); the
port (src/ortho/sgraph.ts:170) accumulates doubles. AC->IW has two corridors
with identical real cost 700.2 (same weight multiset) — C truncates both to
698 (true tie, first-arrival wins, deterministic); the port's FP addition
order splits them by 1 ULP and picks the other corridor.
ruledOut (evidence): maze geometry (GCELL dumps byte-equal ×14 cells),
routing order/edgeLen (ODEDGE dumps identical ×25), snode construction order
(24/25 chains identical by index — impossible if order drove exploration),
cost fn (post-fix all 25 costs byte-equal).
Fix: `Math.trunc` in relax → 2361 geometry byte-identical, CONFORMANT.

## Mechanism 2 — 1856 (Δ108): compass ports ignored at ortho endpoints
C attachOrthoEdges anchors at ND_coord ± ED_*_port.p (ortho.c:1075-76);
1856 has tailport=s/headport=n on every edge. Port buildSpline
(src/ortho/index.ts:72-79) hardcodes bb CENTER. Every attach segment off by
±36 (half node height); corridors identical — not routing at all.
Fix: plumb tailPoint/headPoint = coord + info.*_port.p through OrthoEdge
with center fallback → 1856 byte-identical, CONFORMANT.

**verdict**: fix (both; portable-deterministic; prototyped+validated)

**proposedWriteSet**: src/ortho/sgraph.ts (1 line), src/ortho/types.ts,
src/ortho/index.ts, src/layout/dot/ortho-adapter.ts (+ tests). Working diff
existed in the worktree: 4 files, +17/−3. NO registry entry — T13 is a plain
fix task now.

**regression sweep**: 17 splines=ortho files: 2361+1856 newly byte-identical;
1447_1 improved 284→151, 2620 attr-diffs 666→633; 13 byte-unchanged (incl.
conformant 56, 1880); ZERO regressions; tsc clean; ortho tests 70/70. Note:
the trunc also runs under neato's ortho path — batch survey covers.

**follow-ups**: memory `ortho-maze-corridor-tiebreak-residual` is REFUTED by
this diagnosis — update when T13 lands. 1447_1 improvement feeds T18 (NS).
