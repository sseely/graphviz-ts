<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — seq model

Establish the AGSEQ counter and `Graph.seq` field, wired into both subgraph
creation paths. No emission change yet — this batch is verifiable purely by
unit tests asserting seq values. Single task.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | `Graph.seq` + root subgraph counter + `assignSubgSeq`; wire into parser `processSubgraph` and `agsubg` | sonnet | `src/model/graph.ts`, `src/model/cgraph-ops.ts`, `src/parser/builder.ts`, `src/parser/builder.test.ts` | — | [x] |

Gate after batch: `tsc --noEmit` + `vitest run` green.
