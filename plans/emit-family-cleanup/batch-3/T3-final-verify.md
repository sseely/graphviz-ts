# T3 — final verification and merge-ready summary

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz.
Branch: `feature/emit-family-cleanup`. T1 (gates green) and T2
(worktrees removed) are complete.

This task runs the full gate suite one final time, confirms the
`.claude/worktrees/` directory is empty, and appends a mission
summary to the bottom of `README.md`.

Hook rule: if a pre-commit/length/CCN hook complains, smallest fix,
at most 2 attempts per file, then move on.

## Task

1. Run all four quality gates (same as T1):
   - `npx tsc --noEmit` → exit 0
   - `npx vitest run` → exit 0, failed == 0, passed >= 1466
   - Golden probe + diff → 86 conformant
   - `git diff --name-only HEAD~1..HEAD` → plan files only
2. Confirm `ls .claude/worktrees/` shows the directory as empty (or
   the directory does not exist).
3. If all gates pass and worktrees are gone:
   - Append a `## Mission Summary` section to the bottom of
     `plans/emit-family-cleanup/README.md` with: tasks completed
     (3/3), gate results (pass/counts), worktrees removed (count),
     any known issues or follow-ups, and the merge-readiness signal.
   - Append a row to `decision-journal.md`.
   - Mark T3 `[x]` in this file, `batch-3/overview.md`, and
     `README.md`.
   - Commit: `chore(T3): final verification — emit-family cleanup
     merge-ready`
4. If any gate fails: STOP, document in journal, do not commit,
   do not append summary.

## Write-set (strict — nothing else)

- `plans/emit-family-cleanup/README.md` (append Mission Summary
  section + checkbox updates)
- `plans/emit-family-cleanup/decision-journal.md` (append one row)
- `plans/emit-family-cleanup/batch-3/T3-final-verify.md` (checkbox)
- `plans/emit-family-cleanup/batch-3/overview.md` (checkbox)

Do NOT modify any file in `src/` or `test/`.

## Read-set

- `plans/emit-family-cleanup/README.md` (gates + baseline)
- `plans/emit-family-cleanup/decision-journal.md` (context)
- Output of `ls .claude/worktrees/`

## Architecture decisions (locked)

AD1, AD2, AD3, AD-C1.

## Acceptance criteria

Given T1 and T2 completed:

- When the four quality gates run, then all pass (exit 0, >= 1466
  vitest, 86 conformant goldens, write-set clean).
- When `.claude/worktrees/` is listed, then empty or absent.
- When `README.md` is read, then it contains a `## Mission Summary`
  section at the bottom with gate results and merge-readiness signal.

## Quality bar

All gates pass. One commit per the criteria above. Mission summary
written. Branch ready for Scott's merge-commit review.
