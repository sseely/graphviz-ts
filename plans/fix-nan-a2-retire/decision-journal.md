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
