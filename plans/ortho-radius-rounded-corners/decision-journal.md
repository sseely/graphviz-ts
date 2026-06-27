<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. Every non-trivial judgment call, write-set expansion,
and per-task verification result goes here.

| When | Batch/Task | Decision / Finding | Rationale |
|------|-----------|--------------------|-----------|
| 2026-06-27 | B1/T1 done | `ellipticWedge` ported to ellipse-wedge.ts; output byte-matches C oracle 31/31 pts for the radius=8 quarter wedge (center=(35,26), a1=PI a2=3PI/2, pn=31, arc slice [3..27]). | Faithful port of ellipse.c initEllipse/estimateError/genEllipticPath incl. the coeff tables. C instrumentation in ~/git/graphviz emit.c (temp, reverted T5). |
| 2026-06-27 | B2/T2 done | findOrthoCorners + processCorner + calculateWedgeParameters (8 cases) ported to svg-edge-ortho-radius.ts. graphs-radius edge1: 1 corner @ (27,18), trunc_prev=(27,26) trunc_next=(35,18) wedge=(35,26) a1=PI a2=3PI/2 — all match C oracle. | Faithful port of emit.c:2130-2249; dedup + distinct-skip verbatim. |
