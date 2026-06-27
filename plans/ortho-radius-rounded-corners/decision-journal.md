<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. Every non-trivial judgment call, write-set expansion,
and per-task verification result goes here.

| When | Batch/Task | Decision / Finding | Rationale |
|------|-----------|--------------------|-----------|
| 2026-06-27 | B1/T1 done | `ellipticWedge` ported to ellipse-wedge.ts; output byte-matches C oracle 31/31 pts for the radius=8 quarter wedge (center=(35,26), a1=PI a2=3PI/2, pn=31, arc slice [3..27]). | Faithful port of ellipse.c initEllipse/estimateError/genEllipticPath incl. the coeff tables. C instrumentation in ~/git/graphviz emit.c (temp, reverted T5). |
| 2026-06-27 | B2/T2 done | findOrthoCorners + processCorner + calculateWedgeParameters (8 cases) ported to svg-edge-ortho-radius.ts. graphs-radius edge1: 1 corner @ (27,18), trunc_prev=(27,26) trunc_next=(35,18) wedge=(35,26) a1=PI a2=3PI/2 — all match C oracle. | Faithful port of emit.c:2130-2249; dedup + distinct-skip verbatim. |
| 2026-06-27 | B3/T3 done | orthoRoundedPolylines + segmentPolylines + cornerArcPolylines added. graphs-radius edge1 → 3 polylines: seg1 [(27,71.83),(27,50.5),(27,26)], seg2 [(35,18),(51.04,18)], arc 25pts — byte-match native order/coords. File 228 lines (no split, ADR-3). | Faithful emit.c:2583-2662 segment loop + render_corner_arc slice [3..pn-4]. |
| 2026-06-27 | B4/T4 done | Wired into svg.ts endEdge: orthoRoundedRadius detect → svgEdgePathOrthoRounded. graphs-radius edge1 byte-matches native (3 polylines + arrowhead); edge2 (no radius) stays bezier path (byte-stable). 2440 tests pass. | Emit helpers (svgEdgePathOrthoRounded, orthoRoundedRadius, emitOneBezierPath refactor) placed in svg-helpers.ts — the SVG-emit boilerplate home, alongside svgEdgePath — a minor write-set addition beyond svg.ts (push-forward per ADR-3; no file owned by another task). |
