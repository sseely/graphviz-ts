<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-07-02 | B1 plan | Branch `fix/2796-cluster-ranking` from main (357ddb8). T1 in main session. |
| 2026-07-02 | B1/T1 | Step 0: baseline comparison page byte-verified current (golden + ours). |
| 2026-07-02 | B1/T1 | VERDICT: ranking inputs MATCH — all 44 NS ranking calls (43 clusters + root) line-identical, 2923 constraint edges. The failure is NOT ranking: C's `trouble in init_rank` fires on rank2 call 44 = the X-COORD AUX GRAPH (balance=2, N=1362): C's aux graph is CYCLIC (1271/1362 scanned, 91 unscanned), the port's ACYCLIC (1362/1362). |
| 2026-07-02 | B1/T1 | Divergent aux inputs pinned to 2 sites (creation-ordered site-tagged mkaux diff; identical per-site totals 318/130/565/1400/491): `makeLrvn` two V->V wall edges (C 26 & 24.8 vs TS 18 & 18) and `keepoutOthernodes` one wall edge (C 26 after the 16.4 edge vs TS 24.8 before) — position-cluster.ts:61/:184; C position.c:1052/:392. Plus a flagged sub-ULP FP-print class in make_LR_constraints (5× 30.2 vs 30.200000000000003). Artifact: .agent-notes/2796-ns-inputs-verification.md. |
| 2026-07-02 | B1/T1 | CHECKPOINT (user): pin site then dispose; document related diverged items; author follow-up mission; policy = never replicate acknowledged-unsolved C bugs; review upstream MRs per item. |
| 2026-07-02 | B1/T1 | Related-items sweep (all 25 diverged ids through the oracle + upstream xfail check): family = 2471 (init_rank + 6 lost edges, xfail), 1939 (init_rank, xfail, !4849 target), 1435 (triangulation, xfail), graphs-structs (lost edge, no upstream test). 1367 not family (upstream test passes). 1213 (!4849 target) already conformant in our corpus. 18 other diverged ids have CLEAN oracle stderr = ordinary port gaps. Doc: plans/fix-2796-cluster-ranking/related-diverged-items.md. Follow-up brief authored: plans/verify-oracle-bug-family/README.md. |
| 2026-07-02 | B1/T1 | C instrumentation (ns.c, position.c) reverted, plugin rebuilt, oracle stdout byte-verified; TS dumps (ns.ts, position-aux.ts, position-cluster.ts) reverted; tsc clean. |
| 2026-07-02 | B2 | SKIPPED per D1: ranking inputs match; the x-aux wall-edge divergence is deliberately unfixed (would replicate the acknowledged bug). Open faithful-value question delegated to plans/verify-oracle-bug-family. |
| 2026-07-02 | B3/T5 | Disposition: A4 class added — accepted-divergences entry for 2796 (scope parity, verdict diverged) + full known-divergences.md §A4 write-up with line-pinned links (GitHub blob/main for makeLrvn/keepoutOthernodes/initRank; GitLab @9d6e3abfd2c7 for make_lrvn/keepout_othernodes/init_rank; issue #2796/#2471; draft !4849), per user guidance. PARITY.md regenerated from EXISTING parity.json (no src changes → no survey; accepted tables are report-time joins). Guards 11/11; tsc 0; vitest 2552/2552. |
