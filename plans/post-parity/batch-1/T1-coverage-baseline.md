# T1 — Coverage tooling + baseline report

## Context

graphviz-ts: browser-targeted TypeScript port of C graphviz. Vitest 1.6,
strict TS, esbuild. Suite currently 1027 passed / 0 failed. No coverage
provider installed yet. Scott wants per-file
statements/branches/functions/lines numbers BEFORE any threshold is set
(decisions.md D3); target later is 90/90/90.

## Task

1. `npm i -D @vitest/coverage-v8@^1.6.0` (must match vitest 1.6.x).
2. Extend vitest.config.ts with a `coverage` block: provider `v8`,
   `include: ['src/**']`, exclusions per decisions.md D4
   (src/parser/dot.js, src/parser/dot.d.ts, src/**/__fixtures__/**;
   test/, .probes/, dist/ are outside include already), reporters
   `['text', 'json-summary']`. **NO `thresholds` key yet** (D3).
3. Add `"coverage": "vitest run --coverage"` to package.json scripts.
4. Run it; write `plans/post-parity/coverage-baseline.md`:
   - Overall totals (stmts/branch/funcs/lines %)
   - Per-directory rollup (src/layout/dot, src/layout/neato, …, src/cdt,
     src/vpsc, src/ortho, src/rbtree, src/render, src/gvc, src/common,
     src/model, src/parser, src/pathplan, src/xdot, src/util)
   - The 20 worst files by line coverage with their numbers
   - A one-paragraph estimate of effort to reach 90/90/90 (which dirs
     carry the gap)

## Write-set

package.json, package-lock.json, vitest.config.ts,
plans/post-parity/coverage-baseline.md

## Read-set

vitest.config.ts; decisions.md#D3, #D4

## Interface contract (consumed by checkpoint + batch 3)

coverage-baseline.md as described above; keep the 20-worst table
machine-readable (markdown table: file | stmts% | branch% | funcs% | lines%).

## Acceptance criteria

- Given the dep installed, when `npm run coverage`, then the run exits 0
  (no thresholds) and prints a per-file table
- Given D4 exclusions, when the report is produced, then src/parser/dot.js
  and __fixtures__ files do NOT appear in it
- Given the report, when T1 completes, then coverage-baseline.md exists
  with totals, per-directory rollup, and the 20-worst table
- Given `npx vitest run` (without --coverage), then behavior is unchanged
  (1027/0)

## Observability: N/A — dev tooling. Rollback: Reversible (git revert).

## Quality bar

npx tsc --noEmit clean; npx vitest run 1027+/0. Commit:
`chore(T1): add v8 coverage tooling and baseline report`
