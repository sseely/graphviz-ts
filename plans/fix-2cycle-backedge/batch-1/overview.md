<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — back-edge uses original out-edges

One-line faithful fix + unused-helper removal + tests. The fix is already proven
on the repro (ADR-1); this batch lands it cleanly and validates corpus-wide.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | `handleBackEdge` iterate original out-edges; remove dead `outEdges`; tests | single | `classify.ts`, `classify.test.ts` | — | [x] c8781c5 |

**Gate after batch:** typecheck + tests green; lizard clean; full survey diff vs
`/tmp/parity.before.json` → **0 regressions; the 2-cycle graphs (NaN ×3,
1447_1, and any others) improve**. NaN may keep a small residual (Trap ~43,
out of scope).
