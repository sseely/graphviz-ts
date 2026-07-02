<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-07-01 | B1 plan | Execution plan: T1 (sonnet subagent, docs+JSON) ∥ T2 (main session, diagnosis); disjoint write-sets; branch `fix/nan-a2-retire` from main. |
| 2026-07-01 | B1/T1 | Done (commit 4e1f4b6): §A2 rewritten to measured reality (stale FreeType table + proc3d figures → historical appendix), 3 NaN JSON `reason` fields honest; guard test green; write-set exact. |
| 2026-07-01 | B1/T2 | Residual re-confirmed: nodes 0, edges 8 (the 4 briefed pairs). Per-element diff showed each port spline's interior points bit-identical to the oracle's — assigned to the OPPOSITE 2-cycle member (pure lane swap, Δ=Multisep=18). |
| 2026-07-01 | B1/T2 | Mechanism (CONFIRMED, port-defect): `dispatchEdgeGroup` re-sorts the deduped group by orig seq (`splines-groups.ts:121`); C assigns lanes in edgecmp collected order (MAINGRAPH forward rep first, AUXGRAPH reversed second — `dotsplines.c:419,1898-1925`). 4/4 divergent pairs = reversed-member-first seq; 5th 2-cycle (Target<->TargetF, forward-first) unaffected. Forced-order experiment: 0/0 per-element on all 3 corpus copies. Artifact: `.agent-notes/nan-edge-endpoint-diagnosis.md`. |
| 2026-07-01 | B1/T2 | C tree instrumentation reverted; `gvplugin_dot_layout` rebuilt; oracle SVG byte-verified vs pre-instrumentation baseline. TS temp dumps reverted (git checkout). |
| 2026-07-01 | B1/T2 | STOP-condition flag for T3: `fixLocus` = `src/layout/dot/splines-groups.ts` is OUTSIDE T3's provisional write-set (`edge-route*.ts`, `splines-route*.ts`, `splines-clip.ts`) → write-set expansion ask required before any T3 edit. |
| 2026-07-01 | B2/T3 | Write-set expansion APPROVED by user: + `src/layout/dot/splines-groups.ts`, + `src/layout/dot/splines-groups.test.ts` (new) / `multi-edge.test.ts` for the regression test. |
| 2026-07-01 | B2/T3 | Scope decision: `routeCurvedGroup`'s identical origSeq sort (splines-groups.ts:136, splines=curved path) is NOT touched — no observed defect, different lane model (perp-spread); logged as follow-up in the T2 artifact. Fix stays at the mechanism origin only (diagnosis.md scope-of-change). |
| 2026-07-01 | B2/T3 | Lane fix applied (drop origSeq re-sort, keep edgecmp collected order). Regression test added (edge-route-multi.test.ts, `digraph{x->b; a->b; b->a}`): red pre-fix, green post-fix. |
| 2026-07-01 | B2/T3 | Vitest gate failure #1: #1949 pin 143→124. Diagnosed (not re-tried blindly): second port defect — `markAdjacent` (flat.ts:323) marks cross-rank ND_other entries adjacent (C guards with same-rank, flat.c:274); spurious adjacent=1 on merged 2-cycle reps lets groupSize swallow portcmp breaks; the old sort partially masked it in #1949's aux graph. |
| 2026-07-01 | B2/T3 | Write-set expansion #2 APPROVED by user: + `src/layout/dot/flat.ts` (same-rank guard) + `src/layout/dot/splines-flat.test.ts` (pin 143→142 with rationale). With the guard: #1949 frame matches native exactly (148=148, piece counts match; Δ144 detour-side residual pre-existing, out of scope); NaN still 0/0 ×3. |
| 2026-07-01 | B2/T3 | Gates: tsc 0 errors; vitest 2546/2546; NaN per-element 0/0 on graphs/share/windows; C tree reverted + oracle byte-verified (2nd time); write-set exact. |
| 2026-07-01 | B2/T4 | Watch-graph gate: b15, 2559, b69, honda-tokoro, 2361 + my picks unix/pgram/shells (straight-edge-heavy + flat-order-sensitive) all BYTE-IDENTICAL pre/post-T3. Only graphs/share/windows NaN differ, each 0/0 per-element vs oracle (the intended fix). No away-from-oracle movement; no agent note needed. |
