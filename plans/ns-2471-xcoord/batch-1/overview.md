# Batch 1 — Reproduce + classify

Build the C x-coord oracle + a TS pivot-trajectory probe, reproduce the 2471
`dotPosition` hang, and classify it as **cycling (correctness)** vs
**faithful-but-slow** (→ STOP per ADR-5). This is the decisive fork for Batch 2.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | C x-coord oracle + pivot probe; reproduce; classify | (inline/opus) | decision-journal + harness recipe | — | [ ] |

T1 is investigative — run inline (orchestrator), not a fresh subagent, so the
C-oracle and bundle harness state carry forward. Its output (the classification)
is written to `../decision-journal.md` and gates Batch 2.

Quality gate after T1: no source changes yet (probes are temporary + reverted);
`npm test` still green. The deliverable is the classification + a reusable
harness recipe in the journal.
