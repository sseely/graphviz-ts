<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Faithful fixes (write-sets PROVISIONAL until the Batch-1 gate)

| ID | Description | Agent | Writes (provisional) | Depends On | Done |
|---|---|---|---|---|---|
| T4 | Fix lost edges faithfully + regression test | main loop | src/layout/dot/ortho-adapter.ts + colocated test | T1 | [ ] |
| T5 | Fix cluster labels faithfully + regression test | main loop | src/gvc/device-cluster.ts OR dot label placement + test | T2 | [ ] |

If a pinned origin lands outside these files: ask (write-set expansion),
never halt. One commit per task. TDD: failing test first where feasible.
