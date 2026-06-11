# Batch 3 — Coverage gap-closing to 90/90/90 (DEFINED AT CHECKPOINT)

Placeholder. Do not start. After batch 2, STOP and present
../coverage-baseline.md to Scott. He decides:

- Which directories/files are worth closing vs excluding-with-rationale
- Whether 90/90/90 applies repo-wide or per-directory
- Task split (likely one task per directory cluster: layout engines,
  cdt/rbtree/vpsc substrate, render/gvc, common)

The final task of this batch (whatever the split) flips
`coverage.thresholds = { statements: 90, branches: 90, functions: 90,
lines: 90 }` on in vitest.config.ts — at that moment Gate 6 (T4) starts
enforcing.

Tests written here follow ~/.claude/rules/testing.md (assert specific
values, no non-null-only assertions) and the C-source-is-spec rule:
unit tests must encode C-derived expectations, not port-as-built
behavior — when a test reveals a port divergence, that is a finding,
not a test bug (cf. test-parity D5 for the inverse case).
