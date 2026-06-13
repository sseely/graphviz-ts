# Batch 2 — stale worktree cleanup (single task; after T1 passes)

Remove the seven stale locked git worktrees under
`.claude/worktrees/` that still contain the pre-deletion emit-family
files on disk. These worktrees are at commit points fully subsumed
by `feature/post-parity` (confirmed: `git log <branch>
^feature/post-parity` is empty for all seven).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Remove stale worktrees; prune refs | orchestrator inline | git state only (no source files) | T1 | [ ] |

Pre-condition for each worktree removal:
- Confirm `git log <worktree-branch> ^feature/post-parity` is empty.
- If non-empty: STOP for that worktree; do not remove; record in
  decision journal.

After all removals, run `git worktree prune` to clean dangling refs,
then run `git branch -d` for the corresponding
`worktree-agent-*` branches only if they have zero unique commits.
