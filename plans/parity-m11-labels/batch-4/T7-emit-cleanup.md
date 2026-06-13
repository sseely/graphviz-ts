# T7 — emit-family reachability audit + deletion

## Context

graphviz-ts port. The src/common/emit*.ts family is M9's emit.c port
that was never wired into the live render path (gvc/device.ts +
render/svg*.ts, which now carries all label emission after M10/T4).
Import-level grep (2026-06-12, .agent-notes/label-creation-gaps-2026-06.md)
shows zero live importers for: emit.ts, emit-node.ts, emit-edge.ts,
emit-cluster.ts, emit-xdot.ts, emit-style.ts, emit-bb.ts,
emit-coord.ts, emit-shape.ts (+ emit.test.ts). emit-types.ts IS live
(types) and STAYS. Decision D3 (decisions.md) authorizes deletion
after a symbol-level audit. Hook rule: smallest fix, ≤2 attempts per
file, then move on.

## Task

1. AUDIT (the deletion precondition — do this exhaustively):
   - Enumerate every export of the 9 modules
     (mcp__serena__get_symbols_overview per file).
   - For EACH export, run mcp__serena__find_referencing_symbols. A
     reference from outside the family (excluding emit.test.ts and
     emit-types.ts) = STOP per mission stop conditions; report the
     symbol and referencer.
   - ast-grep structural sweeps for patterns symbol search can miss:
     `sg run -p "import($A)" --lang ts` filtered for emit paths
     (dynamic imports), plus a text grep for `emit-` re-export
     barrels (`export * from`, `export {} from`) outside the family.
2. FOLD CHECK: before deleting, diff each module's logic against its
   live counterpart for anything the live path lacks AND this mission
   needs (e.g. emit-bb helpers, style edge cases). Expected outcome
   after T4: nothing to fold. Anything folded gets @see cites and a
   journal entry, and its target file must be declared in your report.
3. DELETE the 9 modules + emit.test.ts (git rm). emit-types.ts stays.
4. Gates: tsc clean (proves nothing imported them), vitest 0 failed,
   72 goldens byte-identical vs pre-task baseline.

## Write-set

The 10 deletions listed above; fold targets ONLY if step 2 finds
live-needed logic (declare each in the report; if a fold target is
outside src/gvc/ + src/render/, STOP). Nothing else.

## Read-set

All 10 family files; src/gvc/device.ts; src/render/svg-helpers.ts;
.agent-notes/m10-emit-dead-code-2026-06.md

## Acceptance criteria

- Given every family export, when find_referencing_symbols runs, then
  only intra-family/test references exist (evidence in report)
- Given the deletion, then tsc clean, vitest 0 failed, 72 goldens
  byte-identical
- Given any fold, then it carries @see cites + journal entry

## Rollback

Reversible — files recoverable from git history. Commit:
`refactor(T7): delete dead emit family after reachability audit`
(body lists the audit evidence summary).
