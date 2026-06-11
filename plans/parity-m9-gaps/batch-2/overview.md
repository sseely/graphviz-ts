# Batch 2 — rankdir implementation, multi-edge offset, promotion

T6 and T7 run in parallel (disjoint write-sets); T8 after both.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T6 | rankdir LR/BT/RL implementation ([T6-rankdir-impl.md](T6-rankdir-impl.md)) | sonnet | src/common/postproc.ts (new), src/model/geom.ts, src/layout/dot/init.ts, src/layout/dot/index.ts, src/layout/dot/splines-flat.ts, src/common/postproc.test.ts (new) | T4 (batch 1) | [x]¹ |
| T7 | multi-edge parallel offset ([T7-multi-edge-offset.md](T7-multi-edge-offset.md)) | sonnet | src/layout/dot/splines-route.ts, src/layout/dot/cluster.ts, src/layout/dot/multi-edge.test.ts (new) | — | [x]² |
| T8 | promote batch-2 goldens + new RL golden ([T8-promote-goldens.md](T8-promote-goldens.md)) | sonnet | test/golden/* | T6, T7 | [x]³ |

¹ Took 2 agent runs (stream-timeout death mid-task); AD2 option A landed
with the byte-identity gate verified by HEAD-worktree self-baseline
(62/62 byte-identical). Ratified deviations: poly-init.ts unflipped
vertex dims; +svg-graph.ts/nodeinit-adjacent arrow-winding fixes
(journal). LR/BT/RL all PASS maxDelta=0.
² Took 3 agent runs (hook-wrangling death, then watchdog stall);
write-set amended (journal) to include splines.ts dispatch +
edge-route modules + stale-test expectation fixes. PASS maxDelta=0.
³ Executed inline by orchestrator. Manifest 62→66 incl. new
dot-rankdir-rl (AD3; ref provenance verified). Suite 1126/0.

Write-set conflict check: T6 owns common/postproc+geom and dot
init/index/splines-flat; T7 owns dot splines-route/cluster; T8 alone
touches test/golden/. No overlaps. (T6's removal of the splines-flat
flip workaround does not touch T7's files.)
