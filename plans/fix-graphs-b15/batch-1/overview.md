<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Instrument & confirm root cause

Pin the mechanism for the 6 dropped concentrate edges by diffing C's
`dot_concentrate`/`class2` decisions against the port's, for the named edges. No
fix in this batch — output is the diagnosis artifact (mechanism, file:line,
causal chain, ruled-out) that Batch 2 implements against.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Instrument C vs port concentrate path for the 6 edges; produce the mechanism artifact + a failing regression anchor | debugger | `plans/fix-graphs-b15/decision-journal.md`, `.agent-notes/graphs-b15-concentrate-drop.md` | — | [ ] |

Single task. T1 writes only notes/journal (no source change), so it cannot
conflict with Batch 2. Its output is read by T2.
