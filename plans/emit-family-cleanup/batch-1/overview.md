# Batch 1 — gate verification (single task)

Confirm the deletion commit (`a785a86`) satisfies all quality gates
on the current `feature/emit-family-cleanup` branch (branched off
`feature/post-parity`, which contains the deletion). This batch runs
the orchestrator's gates and records the result in the decision
journal. No source files are modified.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Run all quality gates; record results | orchestrator inline | decision-journal.md only | — | [ ] |

If any gate fails, STOP — do not attempt auto-fix. Gate failure means
an assumption in the brief is wrong (a live importer was missed, or
the live path was changed). Document in the journal and wait for
Scott.
