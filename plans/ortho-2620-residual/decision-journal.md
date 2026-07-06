# Decision journal — ortho-2620-residual

| when | task | decision | consequence |
|---|---|---|---|
| 2026-07-05 14:0x | batch-1 dispatch | T1 bounded diagnosis (fable, worktree) — localize+root-cause 2620 pure-ortho edge residual per batch-1/T1-diagnose.md | verdict fix/accept/split drives batch 2 |
| 2026-07-05 14:5x | T1 | verdict SPLIT — (1) ACCEPT: 423-diff residual = fp-contract input ULPs in C poly_init (fma) amplified by faithful ortho relax-trunc; port==strict-IEEE C, proven by -ffp-contract A/B + full input-injection byte-identical (378/378 routes); 2646 class. (2) FIX: edgeLen must read coord not bb-center (ortho.c:1124), src/ortho/index.ts, 3-line | Batch 2: T2b register (fold 2646 fp-contract class) + T2a edgeLen fix |
| 2026-07-05 15:0x | user decision | Batch 2 = ACCEPT (fold 2620 into existing FMA class) + LAND edgeLen fix. User: if an FMA reason exists in the A-list, add to it; else new case. A8 IS the fp-contract/FMA class (2646) → fold 2620 into A8 | T2b registry writer (A8 fold) + T2a edgeLen fix, parallel |
| 2026-07-05 15:2x | T2b | DONE — 2620 registered under A8, class broadened from Proutespline-only to general fp-contract/FMA vs strict-IEEE (2 instances: 2646 Proutespline, 2620 poly_init+ortho); 8 registry tests pass; commit 039b203. WATCH: broadened heading changes A8 anchor — verify refs at merge | merge after gate |
| 2026-07-05 15:4x | T2a | DONE — edgeLen reads ND_coord not bbox center (ortho.c:1124), commit 29584ad; 15/15 renderable ortho cases byte-identical (14/2538 skipped=no twopi/fdp plugin), 2620 unchanged 423/585 (latent-hazard fix per T1), vitest 2735 green | merge |
