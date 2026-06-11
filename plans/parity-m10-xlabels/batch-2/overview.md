# Batch 2 — R-tree node + quadratic splitter

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | node.c + split.q.c port ([T2-node-splitq.md](T2-node-splitq.md)) | sonnet | src/label/node.ts (new), src/label/split-q.ts (new), src/label/node-splitq.test.ts (new) | T1 | [ ] |

Single task: node.c and split.q.c are mutually coupled
(AddBranch → SplitNode → PickSeeds/Classify); one writer avoids
cross-agent circular-import coordination.
