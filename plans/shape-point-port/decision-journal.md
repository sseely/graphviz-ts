<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. One row per non-trivial judgment call.

| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-20 | T1 | Branched `fix/shape-point` off `docs/shape-point-brief` (1 commit ahead of main), not bare `main` | The brief itself is only on the docs branch; the working branch must carry it. Geometrically == main + brief docs. |
| 2026-06-20 | T1 | Reused `assignShapeInfo`→`computeVertices`→`ellipseRings` for point vertices instead of porting point_init's vertex loop verbatim (AD-5 reuse) | The `sides<=2` ellipse path reproduces point_init's rings exactly when `ND_width` is the full outer diameter — verified vertices for peripheries 1 (rx 1.8) and 2 (inner 1.8, outer 5.8) byte-match. Keeps the change minimal. |
| 2026-06-20 | T1 | `poly-inside.ts` left untouched — AD-5 contingency NOT triggered | Point edge-clipping byte-matches the oracle (synthetic `a->b` path `M27,-71.87…` identical). The existing ellipse inside/radius path already reapplies penwidth correctly. |
| 2026-06-20 | T1 | Forced solid fill for points via a `findFillDflt` helper in poly-gencode (fillcolor→color→black), not by routing through `resolveNodeFillEx` | point_gencode never reads the normal isFilled/style path; it always fills with findFillDflt. Solid-only (never gradient) is faithful. Byte-matches color/fillcolor cases incl. fillcolor-wins-for-fill, color-wins-for-pen. |
| 2026-06-20 | T1 | Decomposed `initPointSize`→`pointSizeResult` + made test `texts()` non-regex + split pre-existing `S1: style=striped` describe | Complexity hook (length ≤30 / CCN ≤10). The regex literal `/<text/g` broke lizard's parser, inflating an unrelated function's length; `split('<text')` avoids it. Striped-describe split is a mechanical, behaviour-preserving fix of a pre-existing violation in a touched file. |
| 2026-06-20 | T2 | `2222.dot` byte-match→timeout in one survey run is flaky, NOT a regression | 28k-line, point-free graph renders in ~13.7s alone but exceeds the 20s wall-clock under concurrency-8; confirmed `compareSvg` pass:true in isolation. Re-run survey returned it to byte-match (timeout 6, baseline). |
| 2026-06-20 | T2 | Mission commits use the brief's prescribed messages (feat/test), one per task; plan-doc bookkeeping kept out of the feature commits | Gate `git diff HEAD~1 HEAD` must show only the task write-set; checkbox/journal updates committed separately as mission bookkeeping. |
