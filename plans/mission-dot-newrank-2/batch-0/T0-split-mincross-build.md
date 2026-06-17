# T0 — Split mincross-build.ts under the 500-line cap

## Context

`src/layout/dot/mincross-build.ts` is 529 lines (T3 of the prior mission pushed
it over). The check-complexity.py PostToolUse hook blocks any edit to a file
>500 lines, so this mission cannot touch it until it's split. Pure mechanical
refactor — **zero behaviour change**, goldens byte-identical.

## Task

Extract one cohesive group of functions into a new module and re-export so
existing import sites keep working:

1. Pick the flat-edge cycle-breaking/reorder group as the extraction unit (the
   `flatRev`/`flatSearch*`/`flatBreakcycles*`/`postorder`/`flatReorder*` family,
   ~lines 35-216) → new `src/layout/dot/mincross-flat.ts`. (If a different cut
   is cleaner, that's fine — the goal is `mincross-build.ts` < 500 lines AND the
   new file < 500 lines, with cohesive grouping.)
2. Move the chosen functions verbatim. Add the SPDX header + a module JSDoc.
3. In `mincross-build.ts`, re-export the moved names so dependents that import
   from `./mincross-build.js` still resolve: `export { flatRev, ... } from './mincross-flat.js';`
   OR update the importing sites — prefer re-export to minimise churn.
4. Fix imports the moved code needs (fastgr, mincross-utils, etc.).

Do NOT change any logic, signature, or order of operations.

## Write-set

- `src/layout/dot/mincross-build.ts` — remove the moved group; add re-exports
- `src/layout/dot/mincross-flat.ts` — new module with the moved group
- (only if re-export is not viable) the files importing the moved symbols

## Read-set

- `decisions.md#ad-4`
- `src/layout/dot/mincross-build.ts` (full — to choose a clean cut)
- Whatever imports the moved symbols (grep `from './mincross-build`)

## Acceptance criteria

- **Given** the split, **then** `wc -l` of both `mincross-build.ts` and
  `mincross-flat.ts` is ≤ 500.
- **Given** `npx tsc --noEmit`, **then** exit 0 (all imports resolve).
- **Given** `npx vitest run`, **then** 1839 pass / 0 fail and all 122 goldens
  byte-identical (no behaviour change).
- **Given** `lizard` on both files, **then** no violations.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green; both files ≤500 lines.
Commit: `refactor(T0): split mincross-build.ts under the 500-line cap`.

## Observability / Rollback

N/A. Reversible (revert; pure refactor, goldens byte-identical).
