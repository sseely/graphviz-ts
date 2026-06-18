# Batch 1 — Re-apply the vStart fix + prove it in isolation

Re-apply the known-correct vStart fix, then determine whether Layer 2 reproduces
on a **small** windowed graph (fast loop) or is 2471-scale-only. This is the
decisive fork for Batch 2.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Re-apply vStart fix to medians/reorder + windowed unit tests | sonnet | mincross-order.ts, mincross-order.test.ts | — | [x] |
| T2 | Small multi-component + multi-cluster repros vs C; classify Layer 2 | (inline/opus) | (read-only + plan doc) | T1 | [x] |

T2 is investigative — run inline (orchestrator), not a fresh subagent, so the
harness state and C-oracle context carry forward. Its output (the Layer-2
classification) is written to `../decision-journal.md` and gates Batch 2.

Quality gate after T1: `npm run typecheck` + `npm test` green (the fix must not
regress the 1874-test suite; small windowed graphs may already pass byte-exact).
