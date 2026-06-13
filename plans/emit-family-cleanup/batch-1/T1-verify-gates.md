# T1 — gate verification on current branch

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz (tag
15.0.0). Strict TS, vitest, 86 SVG goldens. Suite baseline 1466/0.

The emit-family source deletion (`emit.ts`, `emit-node.ts`,
`emit-edge.ts`, `emit-cluster.ts`, `emit-xdot.ts`, `emit-style.ts`,
`emit-bb.ts`, `emit-coord.ts`, `emit-shape.ts`, `emit.test.ts`)
already landed in commit `a785a86` on `feature/post-parity`. This
task is run after creating `feature/emit-family-cleanup` (branched
from `feature/post-parity`) and simply runs the gates to verify they
pass — no source changes anticipated.

Hook rule: if a pre-commit/length/CCN hook complains, smallest fix,
at most 2 attempts per file, then move on.

## Task

1. Run `npx tsc --noEmit`. Capture pass/fail + any error output.
2. Run `npx vitest run`. Capture passed/failed counts.
3. Run the golden byte-stability probe:
   `OUTDIR=/tmp/efc npx tsx .probes/render-all.ts`
   then compare: `diff -r /tmp/efc test/golden/refs-port`
   (or equivalent probe pattern established by earlier missions).
4. Record all results in `plans/emit-family-cleanup/decision-journal.md`
   as a single row: date, T1, gate results, rationale "post-deletion
   verification", alternatives "N/A".
5. If all gates pass: mark T1 `[x]` in this file and in
   `batch-1/overview.md` and `README.md`.
6. If any gate fails: STOP. Document the failure in full in the
   decision journal. Do not attempt to fix. Report to Scott.

## Write-set (strict — nothing else)

- `plans/emit-family-cleanup/decision-journal.md` (append one row)
- `plans/emit-family-cleanup/batch-1/T1-verify-gates.md` (checkbox
  update only)
- `plans/emit-family-cleanup/batch-1/overview.md` (checkbox update
  only)
- `plans/emit-family-cleanup/README.md` (checkbox update only)

Do NOT modify any file in `src/` or `test/`.

## Read-set

- `plans/emit-family-cleanup/README.md` (gates + baseline)
- `plans/emit-family-cleanup/decisions.md` (AD1–AD3)
- `.probes/render-all.ts` (understand the probe invocation)
- `test/golden/refs-port/` (golden location)

## Architecture decisions (locked)

AD1 (keep emit-types.ts), AD2 (no folding), AD3 (worktree cleanup is
next batch), AD-C1.

## Acceptance criteria

Given the `feature/emit-family-cleanup` branch (containing `a785a86`):

- When `npx tsc --noEmit` runs, then exit 0, zero errors.
- When `npx vitest run` runs, then exit 0, failed == 0,
  passed >= 1466.
- When the golden probe runs and diffs, then 86 files byte-identical.
- When `git diff --name-only HEAD~1..HEAD` is checked, then only
  plan files are touched (no src/ or test/ changes in this task).

## Quality bar

All four gates pass as stated. One commit:
`chore(T1): verify emit-family deletion gates — all green`

If any gate fails, no commit; document and stop.
