# Batch 2 — rankdir implementation, multi-edge offset, promotion

T6 and T7 run in parallel (disjoint write-sets); T8 after both.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T6 | rankdir LR/BT/RL implementation ([T6-rankdir-impl.md](T6-rankdir-impl.md)) | sonnet | src/common/postproc.ts (new), src/model/geom.ts, src/layout/dot/init.ts, src/layout/dot/index.ts, src/layout/dot/splines-flat.ts, src/common/postproc.test.ts (new) | T4 (batch 1) | [ ] |
| T7 | multi-edge parallel offset ([T7-multi-edge-offset.md](T7-multi-edge-offset.md)) | sonnet | src/layout/dot/splines-route.ts, src/layout/dot/cluster.ts, src/layout/dot/multi-edge.test.ts (new) | — | [ ] |
| T8 | promote batch-2 goldens + new RL golden ([T8-promote-goldens.md](T8-promote-goldens.md)) | sonnet | test/golden/* | T6, T7 | [ ] |

Write-set conflict check: T6 owns common/postproc+geom and dot
init/index/splines-flat; T7 owns dot splines-route/cluster; T8 alone
touches test/golden/. No overlaps. (T6's removal of the splines-flat
flip workaround does not touch T7's files.)
