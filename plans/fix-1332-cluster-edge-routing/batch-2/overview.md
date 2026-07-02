<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — faithful fix + lost-edge semantics + watch gate

**Entry condition:** T1 classification = `port-defect` for at least the 4
geometry edges. If everything is `irreducible` (unlikely), skip to Batch 3.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | Faithful corridor/routing fix at mechanism origin(s) + regression tests | main session | PROVISIONAL: `src/layout/dot/{edge-route-faithful.ts, splines-route*.ts, edge-route-chain.ts}` + matching `.test.ts` — expansion via interactive ask, driven by T1 `fixLocus` | T1 | [ ] |
| T3 | Lost-edge failure semantics (CONDITIONAL — only on D1 rung 2: port polygon now degenerates like C's) | main session | PROVISIONAL: `src/pathplan/shortest.ts`, splines install path, SVG emit gate + tests | T2 | [ ] |
| T4 | 1332 + watch-graph gate | main session | `.agent-notes/`, `decision-journal.md` only | T2 (T3 if run) | [ ] |

T2→T3→T4 serial. T3 collapses into T2 (one commit) if T1 shows one shared
mechanism whose fix directly produces the faithful loss — push-forward, log
it. T3 is SKIPPED (journaled) if `lostEdgeVerdict=irreducible-fp`; the
disposition then happens in T5 per D1 rung 3. Gate after batch: tsc, full
vitest, goldens, 1332 per-element gate. One commit per executed task.
