# Batch 2 — Foundation Algorithms

## Summary

Batch 2 ports the five foundational algorithm libraries that sit below every
layout engine in the dependency graph. These libraries have no inbound
dependencies on other `lib/` folders — they are the bottom layer. All
downstream batches (4 and later) import from the modules produced here.

Batch 2 runs in parallel with Batch 3 (DOT Parser). Both depend only on
Batch 1 completing successfully.

Within the batch, T7, T8, T10, and T11 are fully independent and run in
parallel. T9 depends on T8 completing first — it writes exhaustive
correctness tests for the CDT splay tree and requires the implementation
to exist before tests can be written against it.

## Dependencies

- Requires: Batch 1 complete (project scaffold + type model in place)
- Parallel with: Batch 3
- Blocks: Batch 4

## Task Table

| ID | Description | ‖/→ | Writes | Depends On |
|----|-------------|-----|--------|------------|
| T7 | lib/util port (AgBuffer, LIST, xml escape, math) | ‖ | src/util/agxbuf.ts, src/util/list.ts, src/util/xml.ts, src/util/math.ts, src/util/mt19937.ts, src/util/index.ts, src/util/util.test.ts | — |
| T8 | CDT data structures (DtSplay, DtHash) | ‖ | src/cdt/splay.ts, src/cdt/hash.ts, src/cdt/index.ts | — |
| T9 | CDT DT_OSET iteration order verification | → T8 | src/cdt/cdt-order.test.ts | T8 |
| T10 | Red-black tree with nil sentinel | ‖ | src/rbtree/index.ts, src/rbtree/rbtree.test.ts | — |
| T11 | VPSC constraint solver | ‖ | src/vpsc/Variable.ts, src/vpsc/Constraint.ts, src/vpsc/Solver.ts, src/vpsc/index.ts, src/vpsc/vpsc.test.ts | — |
