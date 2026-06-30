# Mission — emit-family cleanup (dead-code removal)

**IMPORTANT — READ FIRST:** The emit-family source deletion is
**already complete** on `feature/post-parity` (commit `a785a86`,
2026-06-12). The nine dead modules (`emit.ts`, `emit-node.ts`,
`emit-edge.ts`, `emit-cluster.ts`, `emit-xdot.ts`, `emit-style.ts`,
`emit-bb.ts`, `emit-coord.ts`, `emit-shape.ts`) plus `emit.test.ts`
(~1912 lines total) were deleted in that commit after a symbol-level
reachability audit confirmed zero live references outside the family
itself. `emit-types.ts` was retained (live type imports from 12
non-test source files). The live render path — `src/gvc/device.ts` +
`src/render/svg*.ts` — is the golden-validated emit.c port and was
left intact.

This brief documents the residual work: **verification** that the
deletion gates are satisfied on the current branch, and **cleanup**
of the stale locked git worktrees that still contain the old files on
disk (these worktrees are at pre-deletion commit points and are fully
subsumed by `feature/post-parity`; they are an untracked filesystem
artifact, not a branch divergence).

## Confirmed importer graph (grep-verified 2026-06-13)

Command run:
```sh
for f in emit emit-node emit-edge emit-cluster emit-xdot emit-style emit-bb emit-coord emit-shape; do
  grep -rn "from '.*/$f'" src/ --include="*.ts" | grep -v "\.test\.ts" | grep -v "src/common/$f\.ts"
done
```

**Result: zero output for all nine modules.** No live source file
imports any of them. They were only imported by each other and by
`emit.test.ts`, which was deleted with them.

`emit-types.ts` live importers (12 files, verified):

| Importer | Symbol(s) |
|----------|-----------|
| `src/gvc/context.ts` | `TextSpan` |
| `src/gvc/textlayout.ts` | `TextSpan` |
| `src/gvc/device.ts` | `TextSpan` |
| `src/render/dot.ts` | `TextSpan` |
| `src/render/svg.ts` | `TextSpan` |
| `src/render/json.ts` | `TextSpan` |
| `src/render/map.ts` | `TextSpan` |
| `src/render/svg-helpers.ts` | `TextSpan`, `HTML_BF`, `HTML_IF`, `HTML_UL`, `HTML_SUP`, `HTML_SUB`, `HTML_S`, `HTML_OL` |
| `src/common/htmltable-pos.ts` | `HTML_BF`, `HTML_IF`, `HTML_UL`, `HTML_SUP`, `HTML_SUB`, `HTML_S`, `HTML_OL` |
| `src/common/poly-gencode.ts` | `TextSpan` |
| `src/common/make-label.ts` | `TextSpan` |
| `src/common/htmltable-emit.ts` | `TextSpan` |

`emit-types.ts` remains in `src/common/` and is **not deleted**.

## Unique logic audit (fold-vs-delete)

Commit `a785a86` message records: "every module's logic already has a
live-path counterpart (device.ts / svg-helpers.ts / layout) — nothing
folded." The live path is the golden-validated port; the family had
drifted (incompatible `RenderJob` shapes). **Confirmed: no unique C
logic was lost.** Nothing to fold.

## Branch

`feature/emit-family-cleanup` off `feature/post-parity`. Because the
source deletion is already in `feature/post-parity`, this branch will
primarily carry verification commits and the worktree-cleanup script
commit. Merge back with a **merge commit** when all gates pass.

## Canonical rules

- C source at `~/git/graphviz/lib/` (tag 15.0.0) is spec; no src/
  changes that port new C logic are in scope here.
- NEVER modify existing refs, manifest entries, or tolerances;
  `emit-types.ts` is retained as-is (carried AD-C1).
- One commit per task; re-read this README + decision-journal.md
  after every compaction.
- Agent prompts MUST include the hook rule: "if a pre-commit/length/
  CCN hook complains, smallest fix, at most 2 attempts per file, then
  move on." Hook limits: 30 lines/function, CCN 10, 5 params,
  500 lines/file.

## Quality Gates (after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun

- command: npx vitest run
  pass: exit 0 AND failed == 0 AND passed >= 1466
  on_fail: fix_and_rerun

- command: OUTDIR=/tmp/efc npx tsx .probes/render-all.ts && diff -r /tmp/efc test/golden/refs-port
  pass: 82 goldens conformant
  on_fail: stop

- command: git diff --name-only HEAD~1..HEAD
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1466 passed / 0 failed**, 82 goldens
(2026-06-13, post-M12 + emit deletion on feature/post-parity).

Deletion already in tree — vitest baseline excludes the 21 deleted
`emit.test.ts` tests; 82 goldens are conformant to pre-deletion
output (live path unchanged). The suite and goldens are the proof the
deletion was safe.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 (single task) | [T1 gate verification on current branch](batch-1/T1-verify-gates.md) | [ ] |
| 2 (after 1) | [T2 stale worktree cleanup](batch-2/T2-worktree-cleanup.md) | [ ] |
| 3 (after 2) | [T3 final branch verification + merge prep](batch-3/T3-final-verify.md) | [ ] |

## Stop conditions

- `tsc --noEmit` reports errors referencing deleted modules (would
  mean a live import was missed by the grep — stop immediately and
  audit)
- A golden byte-diff fails (would mean the live path was accidentally
  modified — stop; do not attempt to fix by regenerating goldens)
- A worktree-cleanup step attempts to delete a worktree that has
  commits NOT in `feature/post-parity` (check before each removal)
- Any file outside the declared write-set is touched

## Push-forward conditions (journal entry each)

- Hook-forced reformatting of a cleanup script
- `git worktree remove` rejecting a worktree that `git worktree list`
  shows as fully merged — use `--force` with a journal entry
- Worktree locked due to process holding it — `git worktree unlock`
  then retry once

## Key references

- [decisions.md](decisions.md) — AD1–AD3 + carried rules
- [decision-journal.md](decision-journal.md) — append-only log
- [diagrams/component-map.md](diagrams/component-map.md)
- Prior investigation:
  `.agent-notes/label-creation-gaps-2026-06.md` (confidence: High)
- Deletion commit: `a785a86` ("refactor(T7): delete dead emit family
  after reachability audit")
- Carried: `plans/parity-render-styling/decisions.md` (AD-C1)
