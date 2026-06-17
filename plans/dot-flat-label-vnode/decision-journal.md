# Decision Journal — dot-flat-label-vnode

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | C deep dive: ruled out placeVnlabel/gvPostprocess/dispatch (all identical to C). Pinned root: TS aux label vnode not repositioned onto spline (C make_regular_edge moves 33→11.71; TS stays 51) | C-instrumented ground truth |
| 2026-06-17 | — | Fixed C-instrumentation: dot layout lives in gvplugin_dot_layout plugin (GVBINDIR), not libgvc. Rebuild: make dotgen && make gvplugin_dot_layout, copy to /tmp/gvplugins | Build harness now works for ground-truth comparison |
| 2026-06-17 | — | Baseline: tsc 0, vitest 1855 | Pre-mission green |
