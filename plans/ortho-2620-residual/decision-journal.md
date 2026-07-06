# Decision journal — ortho-2620-residual

| when | task | decision | consequence |
|---|---|---|---|
| 2026-07-05 14:0x | batch-1 dispatch | T1 bounded diagnosis (fable, worktree) — localize+root-cause 2620 pure-ortho edge residual per batch-1/T1-diagnose.md | verdict fix/accept/split drives batch 2 |
| 2026-07-05 14:5x | T1 | verdict SPLIT — (1) ACCEPT: 423-diff residual = fp-contract input ULPs in C poly_init (fma) amplified by faithful ortho relax-trunc; port==strict-IEEE C, proven by -ffp-contract A/B + full input-injection byte-identical (378/378 routes); 2646 class. (2) FIX: edgeLen must read coord not bb-center (ortho.c:1124), src/ortho/index.ts, 3-line | Batch 2: T2b register (fold 2646 fp-contract class) + T2a edgeLen fix |
| 2026-07-05 15:0x | user decision | Batch 2 = ACCEPT (fold 2620 into existing FMA class) + LAND edgeLen fix. User: if an FMA reason exists in the A-list, add to it; else new case. A8 IS the fp-contract/FMA class (2646) → fold 2620 into A8 | T2b registry writer (A8 fold) + T2a edgeLen fix, parallel |
