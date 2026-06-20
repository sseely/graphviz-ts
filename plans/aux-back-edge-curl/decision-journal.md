# Decision Journal — aux-back-edge-curl

Appended during execution (per `~/.claude/rules/autonomous-execution.md`).
One writer per row.

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| scope | 2026-06-20 | 6th/final #241_0 mission, scoped from `group-adjacent-flats`'s honest stop. Targets the SECOND divergence: the aux back-edge clone (regular adjacent-rank back edge) routes straight via `routeFaithfulAdjacentBack`, ignoring its corner ports, where C `make_regular_edge` curls it. Builds ON branch `fix/group-adjacent-flats` (grouping is the prerequisite, AD-3). Batch 1 = diagnose-and-prove (AD-1: run the actual config, the lesson from the prior stop); Batch 2 = gated fix + full-corpus regression (AD-4, the crux — back-edge routing is global). The xfail tripwire on the grouping branch is the red test. | The fix is core back-edge routing (high golden-risk) → diagnosis-first + full-corpus gate, narrowest possible gate (hasSidePort). | no |
