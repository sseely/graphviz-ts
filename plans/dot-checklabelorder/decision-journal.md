# Decision Journal — dot-checklabelorder

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | Deep dive: reorder (`haveBackedge`) reachable but rare — 0/300 corpus, only tests/2471.dot (35k lines); 15+ minimal constructions failed to trigger. No clean e2e oracle → unit-test gate. | Instrumented C checkLabelOrder/fixLabelOrder |
| 2026-06-17 | — | Label vnode = info.posAlg; lo/hi from out-edge head orders; recResetVlists ctx not plumbed (cluster-only) | C-vs-TS structural mapping |
| 2026-06-17 | — | Baseline: tsc 0, vitest 1860 | Pre-mission green |
