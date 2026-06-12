# Decision Journal — parity-m11-labels

| Date | Task | Decision | Rationale | Alternatives considered |
|------|------|----------|-----------|------------------------|
| 2026-06-12 | batch-1 | Execution plan: T1/T2/T3 as 3 parallel sonnet agents; disjoint write-sets (nodeinit.ts / edge-label-init.ts / init.ts+postproc.ts); orchestrator commits one per task after gates; baseline goldens at /tmp/m11-baseline | Brief specifies parallel batch 1; no write conflicts | Serial execution (slower, no benefit) |
| 2026-06-12 | batch-1 | GATES: tsc clean; vitest 1250/1250 (1217 base + 33 new: T1=11, T2=14, T3=8); 67 goldens byte-identical vs /tmp/m11-baseline; write-sets verified. Commits c231c64 (T1), 465af5a (T2), T3 follows | All four gates green on first run | — |
| 2026-06-12 | T3 | Accepted agent's new co-located test file postproc-root-label.test.ts (write-set said extend postproc.test.ts, which it also did) | Test file for the module T3 owns; spirit of write-set kept; re-merging would add churn with no benefit | Force-merge into postproc.test.ts; reject and re-run |
| 2026-06-12 | T3 | Agent noted doGraphLabel skips label_pos for root (graph-label.ts:64, outside write-set); placeRootLabel re-reads labelloc/labeljust from attrs, matching the C value GD_label_pos would hold | Compensating read matches C semantics; graph-label.ts untouched per write-set | Patch graph-label.ts (outside write-set — would violate stop conditions) |
