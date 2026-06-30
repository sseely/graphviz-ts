# Decision Journal — dot-flat-aux-label

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | Diagnosed DOT-11: reposition iterates nodes Map not nlist (skips virtual nodes); separately, aux label Y frozen pre-reposition | Black-box probing of make_flat_adj_edges aux pipeline |
| 2026-06-17 | — | nlist fix proven in planning: spline conformant, label X=72, 1853 pass, zero churn | De-risked T1 before brief |
| 2026-06-17 | — | Baseline: tsc 0, vitest 1853 | Pre-mission green |
| 2026-06-17 | T1 | nlist reposition fix committed; labeled-flat spline conformant, no-label flat unchanged, 1855 pass, zero churn. Comparison: comparisons/dot-11a-spline.md | DOT-11a done |
| 2026-06-17 | T2 | **STOP — AD-2 stop condition hit.** Traced label Y: placeVnlabel correctly sets y=72 (verified identical to C place_vnlabel); gvPostprocess then maps spline 71.47→29.95 but label 72→59.25 — inconsistent. Root cause: gvPostprocess applies a rankdir rotation to the aux graph (nodes auxt 117→18, auxh 27→18 collapse to one rank); the rotation maps the label via its pos.x (which carries the dimen.y/2 centering offset), turning that x-offset into a ~22pt y-error. The spline has no such offset, so it stays exact. Fix lives in the SHARED gvPostprocess label rotation / the aux graph's flip configuration — changing it risks the 1853 regular-edge goldens (AD-2: do not change non-aux label placement). Exceeds a bounded task. | T2/T3 deferred; T1 shipped. Needs a focused gvPostprocess/aux-flip investigation, not a hack. |
