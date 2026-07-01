# Decision journal — fix-1949

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-30 | Compound-edge MR is a no-op for the port | Already ported; port never asserted. Chased the real divergence instead. |
| 2026-06-30 | D1 fix = decode entities in htmltable-lex scanText | Single choke point; mirrors C expat; reuses htmlEntityUTF8 (moved to html-entities.ts leaf to avoid cycle). |
| 2026-06-30 | D2 fix = pen-color inheritance (table→cell→nested) | Mirrors htmltable.c:1911/1406/1556; emit `?? 'black'` kept as true default. |
| 2026-06-30 | Stop at 2.97px y-residual | Pre-existing, distinct cluster-label LR order-axis placement bug; not a 1949 root cause. Logged as follow-up. Survey gate PASS, 0 regressions. |
