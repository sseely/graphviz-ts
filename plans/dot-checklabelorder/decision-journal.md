# Decision Journal — dot-checklabelorder

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | Deep dive: reorder (`haveBackedge`) reachable but rare — 0/300 corpus, only tests/2471.dot (35k lines); 15+ minimal constructions failed to trigger. No clean e2e oracle → unit-test gate. | Instrumented C checkLabelOrder/fixLabelOrder |
| 2026-06-17 | — | Label vnode = info.posAlg; lo/hi from out-edge head orders; recResetVlists ctx not plumbed (cluster-only) | C-vs-TS structural mapping |
| 2026-06-17 | — | Baseline: tsc 0, vitest 1860 | Pre-mission green |
| 2026-06-17 | T1 | Ported fixLabelOrder + getComp/topsort/linkConflicts in label-order.ts. VERIFIED against C ground truth: instrumented C, dumped the 2471.dot rank-9 LabelNodes (7) + exact reorder, and my fixLabelOrder reproduces the position←orig mapping exactly (MATCH=true). 1862 pass. | Don't trust my reading of isBackedge semantics — pin to C ground truth |
