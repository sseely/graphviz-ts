# Batch 0 — Split mincross-build.ts (mechanical, unblocks edits)

Single task. `mincross-build.ts` (529 lines) exceeds the 500-line hook cap, so
no in-session edit lands until it's split. Pure refactor: extract a cohesive
group into a new module, re-export to keep import sites stable, goldens
byte-identical.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T0 | Split `mincross-build.ts` under 500 lines | opus | `src/layout/dot/mincross-build.ts`, new `src/layout/dot/mincross-flat.ts`, import sites if needed | — | [ ] |

Commit: `refactor(T0): split mincross-build.ts under the 500-line cap`.
