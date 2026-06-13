# T2 — stale worktree cleanup

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz.
Current branch: `feature/emit-family-cleanup` (off `feature/post-
parity`). T1 has verified all gates pass.

Seven stale locked git worktrees exist under `.claude/worktrees/`.
They were created by prior autonomous agent sessions and are at commit
points at or before `feature/post-parity`. The worktrees still hold
the pre-deletion emit-family files (emit.ts etc.) on disk — these are
not in `src/` of the main worktree; they are in the locked worktree
directories. Removing them is safe: the branches are fully subsumed
by `feature/post-parity`.

Worktrees to evaluate (verified 2026-06-13):

| Worktree dir | Branch | Unique commits vs post-parity |
|---|---|---|
| agent-a205a9b4e56ad3864 | worktree-agent-a205a9b4e56ad3864 | 0 |
| agent-a7c8e94fee4b76454 | worktree-agent-a7c8e94fee4b76454 | 0 |
| agent-a8390b63b9a90d79f | worktree-agent-a8390b63b9a90d79f | 0 |
| agent-acdfd75414a43cce4 | worktree-agent-acdfd75414a43cce4 | 0 |
| agent-ad8c7c7c61bf2c37d | worktree-agent-ad8c7c7c61bf2c37d | 0 |
| agent-af8ee944fa4a79584 | worktree-agent-af8ee944fa4a79584 | 0 |
| agent-aff5e70b995d3283a | worktree-agent-aff5e70b995d3283a | 0 |

Hook rule: if a pre-commit/length/CCN hook complains, smallest fix,
at most 2 attempts per file, then move on.

## Task

For each worktree in the table:

1. Re-verify: `git log worktree-agent-X ^feature/post-parity`
   — must be empty. If non-empty: STOP this worktree, journal it,
   continue with the remaining ones.
2. If verified empty: `git worktree unlock .claude/worktrees/agent-X`
   (unlock if locked), then
   `git worktree remove .claude/worktrees/agent-X --force`
3. After all removal attempts: `git worktree prune`
4. For each successfully removed worktree: delete the corresponding
   tracking branch only if it has zero unique commits.
   `git branch -d worktree-agent-X`
   (use `-d` not `-D`; if `-d` refuses, the branch has unmerged
   commits — stop and journal, do not force-delete).
5. Confirm `.claude/worktrees/` is empty (or contains only worktrees
   with unique commits, if any were stopped).
6. Record results in `decision-journal.md`.

Do NOT remove the main worktree (`/Users/scottseely/git/graphviz-ts`).
Do NOT touch `src/`, `test/`, or any plan file beyond the journal.

## Write-set (strict — nothing else)

- Git state: worktree removal + branch deletion (no source files)
- `plans/emit-family-cleanup/decision-journal.md` (append one row)
- `plans/emit-family-cleanup/batch-2/T2-worktree-cleanup.md`
  (checkbox update only)
- `plans/emit-family-cleanup/batch-2/overview.md` (checkbox update)
- `plans/emit-family-cleanup/README.md` (checkbox update)

## Read-set

- `plans/emit-family-cleanup/README.md` (stop conditions)
- `plans/emit-family-cleanup/decisions.md` (AD3)
- Output of `git worktree list` (current state before starting)
- Output of `git log <branch> ^feature/post-parity` for each branch

## Architecture decisions (locked)

AD3 (worktree cleanup is `git worktree remove`, not source change;
confirm zero unique commits before removal; stop if unique commits
found).

## Acceptance criteria

Given the seven worktrees listed:

- When `git log <branch> ^feature/post-parity` is run for each, then
  each returns empty output (zero unique commits).
- When `git worktree remove` is run for each, then exit 0.
- When `git worktree list` is run after cleanup, then only the main
  worktree remains (no `.claude/worktrees/agent-*` entries).
- When `git worktree prune` is run, then exit 0.
- When `ls .claude/worktrees/` is run, then the directory is empty or
  absent.

## Quality bar

All worktrees removed cleanly. One commit:
`chore(T2): remove stale pre-deletion worktrees`

Body: list each worktree removed, confirm zero unique commits per
worktree.
