<!-- SPDX-License-Identifier: EPL-2.0 -->
# T4 — polypoly ×3 (diagnosed 2026-07-04, agent-verified) — FIX, acceptance REFUTED

**mechanism**: `polygonBB()` (poly-sizing.ts:442-455) computes `nbb` — the box
C actually realizes the base periphery ring at after folding the
distortion-inflated vertex extent back in (shapes.c:2288-2296: xmax*=2; bb =
fmax(width,xmax); scale=bb/xmax) — but `polySize()` (:519-527) hardcodes
`base: c.bb` (the PRE-inflation ellipse-fit box), discarding nbb. For
undistorted regular polygons nbb === c.bb exactly, so the bug is invisible
except distortion/skew ≠ 0 AND peripheries ≥ 2 — precisely node 9011
(sides=4, orientation=45, distortion=0.5, regular, peripheries=2).
generalPolyRings (peripheries>1 branch) sizes the base ring SOLELY from
box.base and walks outer rings outward → whole rendered polygon chain
undersized (55.50 vs 68.59) while the node's own width/height (correctly fed
from nbb) match — why only this node's polygons diverge in a 150-node graph.

**origin**: src/common/poly-sizing.ts:519-527 (polySize `base: c.bb`) +
:442-455 (polygonBB not returning nbb).

**ruledOut**: sub-ULP float noise (bucket hypothesis) — REFUTED: the correct
value is computed bit-for-bit and discarded; the fix yields EXACT match.
Rotation/ellipse-fit formula error — C dump bb_after_shapefit
(55.5024474365, 35.0724963469) matches port exactly. Label measurement — C
dimen (12.4482421875, 16.8) bit-identical to port. ratio=fill as delta-split
driver — post-fix all three ids 0-diff.

**verdict**: fix

**proposedWriteSet**: src/common/poly-sizing.ts (polygonBB returns base=nbb
in both return paths; polySize uses grown.base; ellipse/sides<3 path keeps
c.bb — base unconsumed there) + poly-sizing.test.ts regression (TDD fixture:
distortion=0.5, orientation=45, regular, peripheries=2,
labelDimen={x:12.4482421875, y:16.8} → baseW=baseH≈68.58957430334).
NO registry entry — T14 becomes a plain fix task.

**evidence**: post-fix node 9011 polygons byte-identical to oracle in all 3
files; compareSvg pass ×3; tsc clean; poly suites 28/28. Corpus blast-radius
grep: distortion/skew appears only in polypoly ×3 (peripheries=2) and
crazy/rankdir families (peripheries=1, provably unaffected).

C dumps (agent transcript): xmax=ymax=68.5895743033/2 per ring, scalex=1.0,
bb_final=(82.2464285528,…), v[0]/(v[4]/v[8]) ring vertices.
