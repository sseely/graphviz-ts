# Batch 3 — final verification + merge prep (single task; after T2)

Run the full gate suite one final time on the clean branch, confirm
the worktree directory is gone, and produce a summary in the decision
journal. This is the merge-readiness signal for Scott.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Final gate run + merge-ready summary | orchestrator inline | decision-journal.md, README.md summary | T2 | [ ] |

No source changes. If gates pass, write the mission summary section
to the bottom of README.md (tasks completed, gate results, any known
issues) and await Scott's go-ahead to merge.
