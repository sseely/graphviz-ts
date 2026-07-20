<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 4 — closeout

Single task after T3/T4/T5 merge to the mission branch. Runs the combined broad
sweep (catches cross-task interactions the isolated worktrees could not see),
classifies every remaining diverged id, and writes the accept-class
documentation required by the project Quality Bar.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T6 | Final combined sweep + classify all + known-divergences + journal summary | self | `test/corpus/parity-neato.json`, `docs/known-divergences.md`, `plans/neato-close-diverged/decision-journal.md`, comparison pages for any accept/quarantine case | T3, T4, T5 | [ ] |
