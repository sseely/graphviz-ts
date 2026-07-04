
## Observation: pre-existing process.env in browser-targeted src
- **Context**: TS6 upgrade (2026-06-22). TS6 stopped auto-loading @types/*; added
  `"types": ["node"]` to tsconfig.json base to restore node globals.
- **Finding**: `src/layout/neato/splines.ts:464` and
  `src/layout/neato/stress-kernel.ts:347` use `process.env[...]` in published
  (non-test) source. CLAUDE.md forbids process.env in browser library code. These
  predate the upgrade (TS5 silently allowed them via implicit @types/node load).
  Because tsconfig.build.json extends the base, the declaration build also has node
  types in scope, so a clean `"types": []` split in build config is blocked until
  these two callsites are guarded/removed.
- **Impact**: Dedicated cleanup PR: guard the two process.env reads (e.g.
  `typeof process !== 'undefined'` or inject via config), then set
  `"types": []` in tsconfig.build.json so library source can't reach Node globals.
  Out of scope for the dep-bump (pr-workflow: no unrelated fixes in a chore PR).
- **Confidence**: High (verified via tsc TS2591 behavior with types omitted).
