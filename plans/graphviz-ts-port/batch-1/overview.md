# Batch 1 — Type System and Graph Model

## Summary

Batch 1 establishes the complete TypeScript type system that every subsequent
batch imports from. No algorithm logic lives here. All types are derived
directly from the C source headers in `lib/common/geom.h`, `lib/common/types.h`,
and `lib/cgraph/cgraph.h`. Field names match their C counterparts exactly.

This batch produces the `src/model/` tree and the project scaffold. Once all
six tasks are complete, downstream batches can import typed graph objects
without encountering unresolved symbols.

## Dependencies

- T1 (scaffold) and T2 (geometry types) are independent of each other and run
  in parallel.
- T3 (graph classes) requires T2 to exist before it can reference `Box` and
  `Point` in field types.
- T4, T5, T6 (GraphInfo, NodeInfo, EdgeInfo) each require T2 and T3 and may
  run in parallel once T3 is complete.

## Task Table

| ID | Description | ‖/→ | Writes | Depends On |
|----|-------------|-----|--------|------------|
| T1 | Project scaffold | ‖ | package.json, tsconfig.json, vitest.config.ts, .gitignore, .github/workflows/ci.yml | — |
| T2 | Geometry primitives | ‖ | src/model/geom.ts | — |
| T3 | Graph, Node, Edge base classes | → T2 | src/model/graph.ts, src/model/node.ts, src/model/edge.ts, src/model/index.ts, src/model/model.test.ts | T2 |
| T4 | GraphInfo interface | ‖ after T3 | src/model/graphInfo.ts | T2, T3 |
| T5 | NodeInfo interface | ‖ after T3 | src/model/nodeInfo.ts | T2, T3 |
| T6 | EdgeInfo interface | ‖ after T3 | src/model/edgeInfo.ts | T2, T3 |
