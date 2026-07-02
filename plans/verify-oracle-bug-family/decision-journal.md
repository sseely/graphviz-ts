<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-07-02 | setup | Branch `chore/verify-oracle-bug-family` from main (41ed6cd). Batch structure refined from README's suggested shape: B1 upstream review → disposition matrix; B2 inputs verification (2471 first) + inherited faithful-wall-edge question; B3 conditional fixes; B4 dispositions + survey + merge. Executed inline (single-agent) — the C tree `~/git/graphviz` is a shared mutable resource, so instrumentation tasks cannot parallelize; upstream review is small. |
| 2026-07-02 | B1/T1 | Upstream review done. All of #2471/#1939/#1435 still OPEN + xfail(strict) at checkout 9d6e3abfd (2026-06-10). Draft MR !4849 (targets #1213/#1939/#2796) still an open draft, last edited 2026-03-20 — NOT resolved. graphs-structs = ancient record-routing-loss family (#102/#242/#274/#1323), no dedicated test. Matrix: decisions.md#D1. |
| 2026-07-02 | B1/T1 | NEW finding vs brief assumptions: the PORT is not clean on 2471 — 9 lost edges (oracle 6; 5 common). D3: this gates 2471's acceptance and is B2's top question. 1939 + graphs-structs port-clean (2796 shape); 1435 both sides degrade without edge loss. |
