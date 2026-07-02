<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Fixes (provisional loci; ask on expansion; one commit each)

| ID | Description | Agent | Writes (provisional) | Depends On | Done |
|---|---|---|---|---|---|
| T5 | user_shapes shapefile fallback + test | main loop | shape resolution (from T3) + test | T3 | [ ] |
| T6 | b69 append-order fix + test | main loop | splines-clip.ts / driver (from T1) + test | T1 | [ ] |
| T7 | hyphen/context escaping + test syncs | main loop | src/render/xml-escape.ts + tests (from T4) | T4 | [ ] |
| T8 | b15 fix + test IF T2=bounded; else disposition note | main loop | ≤2 files (from T2) | T2 | [ ] |

Red/green-verify every regression test against pre-fix code (2183 lesson:
distilled repros can silently pass — prefer verbatim corpus sources).
