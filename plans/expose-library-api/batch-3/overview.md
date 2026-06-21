# Batch 3 — Entry points + wiring

Assemble the two subpath entries and wire the root. T7/T8 are independent
(different barrels); T9 depends on both and owns the only shared/modified files.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T7 | `graphviz-ts/api` barrel | typescript-pro | `src/api/index.ts` | T2, T3, T4 | [ ] |
| T8 | `graphviz-ts/render` barrel | typescript-pro | `src/render/index.ts` | T5, T6 | [ ] |
| T9 | Root wiring + package exports + build | typescript-pro | `src/index.ts` (mod), `package.json` (mod), `src/entry.test.ts` | T7, T8 | [ ] |

## Notes

- `src/render/index.ts` (T8): if a file already exists there, T8 **modifies** it
  (extend, don't clobber) and the write-set note in the journal must say so.
  Confirm at task start with `ls src/render/index.ts`.
- T9 owns `src/index.ts` AND `package.json` — single writer, no conflict.

## Interface outputs

- T7 → module `graphviz-ts/api` exporting builder + geometry + edge-ops + types.
- T8 → module `graphviz-ts/render` exporting `render`, `OutputFormat`,
  `getDrawOps`, xdot op types.
- T9 → `package.json` `"exports"` map (`.` / `./api` / `./render`), 3-output
  esbuild build, root re-exports.

## Gate after batch

`npm run typecheck && npm test && npm run build` (verify dist/index.js,
dist/api.js, dist/render.js all emitted), then `git diff --name-only` matches the
write-set.
