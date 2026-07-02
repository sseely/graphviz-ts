<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Fixes / dispositions (one commit per id-task; provisional loci)

| ID | Description | Agent | Writes (provisional) | Depends On | Done |
|---|---|---|---|---|---|
| T6 | decorate feature port + golden test | main loop | edge-label emit + render (from T1) | T1 | [ ] |
| T7 | anchors fix + test (1880, 2619_1/2) | main loop | src/render anchor sites (from T2) | T2 | [ ] |
| T8 | 2239 fix + test | main loop | (from T3) | T3 | [ ] |
| T9 | 1367 fix / classification + test | main loop | (from T4) | T4 | [ ] |
| T10 | 1581/2825 dispositions or input fixes; comparison pages; registry + docs + guard syncs | main loop | test/corpus/accepted-divergences.json, docs/known-divergences.md, comparisons/ (from T5) | T5 | [ ] |

Red/green-verify every regression test (corpus-verbatim preferred);
distilled repros only if they discriminate. D3: any deep verdict →
disposition artifact instead of a fix.
