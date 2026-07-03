<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Per-id diagnosis (no src/ edits; sequential)

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | decorate: C spec extraction | main loop | journal (+note) | — | [x] |
| T2 | anchors: 1880 + 2619_1/2 missing <a> classes | main loop | journal (+note) | — | [x] |
| T3 | 2239: +51 polygons origin | main loop | journal (+note) | — | [x] |
| T4 | 1367: raw-0x80 semantics + g[7] childCount | main loop | journal (+note) | — | [x] |
| T5 | 1581 + 2825: upstream tests + inputs verification (D4) | main loop | .agent-notes/*.md, journal | — | [x] |

Order push-forward: quick wins first. Per-id mechanism journaled before
that id's Batch-2 task. C instrumentation reverted + oracle
byte-verified before each id closes.
