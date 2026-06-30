<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. One row per non-trivial judgment call.

| Date | Batch/Task | Decision | Rationale |
|------|-----------|----------|-----------|
| 2026-06-29 | B0/T0 | Add-order divergence root-caused to `labelVnode` lw (classify.ts), NOT subtree-merge. | Paired XNSDBG instrumentation: 3 FT add-order diffs, all merge-phase (idx≥297), first at i=323 (27th merge). C adds (284→332), port (284→333). Cause: node 333 (edge-label vnode) `lw`=7(C)/0(port). C `label_vnode` sets `ND_lw=GD_nodesep(agroot(v))`; port `labelVnode` used `g.info.nodesep` (cluster g → 0). Δ7 → minlen(4→333) 15 vs 8 → rank(333) 428 vs 421 → flips min-slack pick in interTreeEdgeSearch. Subtree-merge code is faithful. |
| 2026-06-29 | B0→B1 | Scope expanded to `classify.ts` (user-authorized mid-T0). Original write-set (ns-subtree/ns-core/ns-range) is NOT the locus. | Stop condition "fix needs files outside 3 NS files" triggered; user explicitly authorized expanding write set to classify.ts. Fix = `labelVnode` lw uses root nodesep (agroot) like C. |
| 2026-06-29 | B1 | Regression test added to `classify.test.ts` (not ns-subtree.test.ts as T1 assumed). | The fix is in classify, not NS. Test renders labeled long edge inside a cluster, asserts n1 cx=98 (native); fails (cx=80) without fix. Verified fix-sensitive by temp revert. NS unit tests (54) untouched + still green. |
| 2026-06-29 | B2 | Survey gate PASS — refreshed baseline + marked batches done. | 0 regressions. Deterministic-tolerance matches (harness `conformant` = ±0.01, NOT literal bytes) 522→525: share-b51, windows-b51, graphs-b53 diverged→`conformant`. maxΔ also dropped for 2471 (5728→3781), 2796, graphs-decorate (no verdict change). `incrWidth` left on subgraph nodesep (matches C `incr_width`) — fix scoped to labelVnode only. |

## Mission summary (2026-06-29)
- **Tasks:** T0 (diagnose), T1 (fix+test), T2 (survey) — all complete.
- **Outcome:** share-b51 blok_60 now matches C exactly (Δ0 on its coordinates;
  was 158px off). Root
  cause was NOT the subtree-merge add-order (those files were faithful) but
  `labelVnode` reading subgraph instead of root nodesep for an edge-label vnode's
  `lw`. The mission's premise (fix tight_tree add order in ns-* files) was
  superseded by the deeper diagnosis; user authorized the classify.ts scope.
- **Gates:** tsc 0; NS+position unit tests 54/54; classify regression test green;
  full survey 0 regressions, deterministic-tolerance matches (harness
  `conformant` = ±0.01) 522→525.
- **Follow-up (not in scope):** 2471/2796/graphs-decorate improved but still
  diverged — separate classes; the b51 fix only partially helped them.
