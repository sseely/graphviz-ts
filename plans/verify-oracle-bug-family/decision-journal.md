<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-07-02 | setup | Branch `chore/verify-oracle-bug-family` from main (41ed6cd). Batch structure refined from README's suggested shape: B1 upstream review → disposition matrix; B2 inputs verification (2471 first) + inherited faithful-wall-edge question; B3 conditional fixes; B4 dispositions + survey + merge. Executed inline (single-agent) — the C tree `~/git/graphviz` is a shared mutable resource, so instrumentation tasks cannot parallelize; upstream review is small. |
| 2026-07-02 | B1/T1 | Upstream review done. All of #2471/#1939/#1435 still OPEN + xfail(strict) at checkout 9d6e3abfd (2026-06-10). Draft MR !4849 (targets #1213/#1939/#2796) still an open draft, last edited 2026-03-20 — NOT resolved. graphs-structs = ancient record-routing-loss family (#102/#242/#274/#1323), no dedicated test. Matrix: decisions.md#D1. |
| 2026-07-02 | B1/T1 | NEW finding vs brief assumptions: the PORT is not clean on 2471 — 9 lost edges (oracle 6; 5 common). D3: this gates 2471's acceptance and is B2's top question. 1939 + graphs-structs port-clean (2796 shape); 1435 both sides degrade without edge loss. |
| 2026-07-02 | B2/T2 | 2471 VERDICT: ranking inputs MATCH (calls 0-251 line-identical of 253); x-aux call 252 diverges in 51 cluster-wall edges. MECHANISM PROVEN: port's flatEdges skips C's rec_reset_vlists (flat.c:333; deferred at DOT-5 AD-4 as "needs MincrossContext") → stale cluster windows after flat-label vnode insertion. Evidence: C's first reset ≡ port's reset (0-diff/344 lines); C's second reset differs in 124 lines. Artifact: .agent-notes/2471-stale-cluster-windows-missing-reset.md. |
| 2026-07-02 | B2/T2→T6 | T6 answered early: C computes the faithful wall-edge values; the port variant = missing call, and it mislays layouts (port loses 9 edges on 2471 vs oracle 6). 2796's A4 "wall-edge variant" is retroactively THIS defect (26/24.8 = margin 8 + label-vnode widths 18/16.8; port's 18 = 8+10 plain vnode). |
| 2026-07-02 | B2 gate→B3 | DECISION (judgment call, logged per rules): implement the faithful fix now (brief pre-authorizes "fix genuine input defects faithfully"; CLAUDE.md C-is-sacred). Known consequence: family ids may reproduce C's acknowledged-broken aux-cycle outcome — that is a DISPOSITION matter (no-replication policy governs chasing/dispositions, not whether to port a legitimate C call). Tension flagged for user review in the T2 note + final report. Survey regression gate remains the hard check. |
