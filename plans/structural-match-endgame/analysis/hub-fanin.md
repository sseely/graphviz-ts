<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — b29×4 + b124×3 hub-fanin family (diagnosed 2026-07-04, agent-verified)

**mechanism**: `swapBezier` (src/layout/dot/splines.ts:274-278) does
`b.list.reverse()` — reversing the ENTIRE over-allocated list — where C's
`swap_bezier` (dotsplines.c:144-148) reverses only the first `b->size`
entries. When an edge (a) lost a whole segment to clipping (size =
list.length − 3, spare slots zeroed at the tail — faithful to C's calloc) AND
(b) was reversed during layout (dir=back / 2-cycle → edgeNormalize →
swapEdgeSpline → swapBezier), the 3 zeroed spares land at indices 0-2; emit
slices list[0..size) → 3 junk (0,0) points (→ M<tx>,0) + real spline truncated
by 3.

**origin**: src/layout/dot/splines.ts:274-278 vs C dotsplines.c:144-148

**causalChain**: newSpline pre-allocates pn slots (faithful) → clip drops a
terminal segment (arrow clip at crowded hub / shape clip segment-inside) →
size = pn−3, zeroed tail (faithful) → full-array reverse moves spares to the
FRONT (deviation) → emit renders junk + truncation; maxΔ 1988-2588.

**ruledOut**: already-closed (re-verified post-b15-rework: Δ2559-2588/1988);
layout divergence (all node polygons byte-identical); routing divergence
(port[3..18] ≡ oracle[0..15] exactly — identical spline, shifted window); b15
groupSize fragmentation (same bezier counts); A3 hypot-ULP class (that moves
one knot ~20pt; this is junk-points + exact-equal real points). Isolation:
non-reversed edges with identical trims do NOT diverge — exactly the
reversed×trimmed intersection (3 edges/graph) diverges, matching 3
instrumentation hits/graph.

**verdict**: fix

**proposedWriteSet**: src/layout/dot/splines.ts (swapBezier size-bounded
reverse; swapSpline is safe — spline list.length===size always) +
src/layout/dot/splines.test.ts regression (spare tail slots stay in place).

**evidence**: candidate fix in worktree → all 7 ids compareSvg pass=true,
0 diffs, maxΔ=0; tsc clean; 2650 tests pass. Instrumentation dumps in the
agent transcript (clip bounds + swap size/listLen per diverging edge).
