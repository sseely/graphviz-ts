<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Per-id inputs verification at the failing C stage

Recipe: the 2796 dump method (`.agent-notes/2796-ns-inputs-verification.md`)
— env-gated mirrored C↔TS dumps at `rank2` entry + `make_aux_edge`
(site-tagged, creation-ordered), virtual-name normalization, line diff.
End state per task: C tree reverted, plugin rebuilt, oracle stdout
byte-verified.

| task | description | status |
|---|---|---|
| T2 | **2471** inputs verification (worst instance: init_rank + 6 lost edges). Verify ranking calls match; pin x-aux divergences; check whether the 6 lost edges trace to the same aux-cycle recovery state or to an independent port input defect. | [ ] |
| T3 | **1939** inputs verification (init_rank; !4849 target). | [ ] |
| T4 | **1435** inputs verification — no init_rank stage; failing stage is pathplan triangulation, so verify the *inputs to the spline router* (node positions/boxes) rather than NS constraints if ranking matches. | [ ] |
| T5 | **graphs-structs** — oracle loses `struct1->struct3` (Pshortestpath failed); verify the port's router inputs at the equivalent point; decide class (same pathplan-loss family?). | [ ] |
| T6 | Inherited faithful-value question: which side computes the faithful makeLrvn/keepout wall-edge lengths (C 26/24.8 vs TS 18/18), and does the port's variant mislay any CLEAN-oracle graph? (Read C `make_lrvn` margin math vs port; corpus-scan reasoning.) | [ ] |

Serialized (shared C tree). Write-set: `.agent-notes/*.md`, journal;
TEMPORARY `~/git/graphviz/lib/**` + TS dump code (reverted). No production
`src/**` edits in this batch.
