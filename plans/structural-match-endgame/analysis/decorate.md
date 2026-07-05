<!-- SPDX-License-Identifier: EPL-2.0 -->
# T8 — graphs-decorate (diagnosed 2026-07-04) — ACCEPT (A3 family)

All 23 diffs live in one <g> (edge Se3ffa656...->Se3ffa61c..., labeled,
adjacent-rank, INTRA-cluster — the "cluster-crossing corridor" framing was
stale). findMaxDev interior deviations: 77.56953556793451 vs ...54 (3e-14
abs, ~4e-16 rel) — exact double-noise tie; C's raw `>` via Apple libm hypot
keeps-second, port's documented tolerant tie-break keeps-first; the mirrored
split cascades to arrowhead + decorate connector (closest-point-on-spline).

ruledOut (each against live C-instrumented plugin rebuilds, then reverted):
box construction/maximal_bbox/rank_box (byte-identical), adjust/complete
regular path widening, beginPath/endPath dispatch (C poly_path is a no-op
stub — port's pboxfn:null equivalent), buildPolyPoints/flip, shortestPath
funnel, evs tangents. routeSplinesInternal inputs byte-identical.

verdict: accept — same irreducible class as 2368/241_1/b100/b104; per D1
C's winner is non-portable; flipping the port tie-break relocates the
residual to the already-fixed cases (route.ts:192-208 comment).

registry: handled by T12 (batch-3 registry writer) together with
2413_1/2413_2 — one A3-extension entry set + prose + guard lines.
