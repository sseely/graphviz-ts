# Batch 3 — Verify + finalize (sequential)

Depends on Batch 2.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| T7 | Goldens per arrow-type group + manifest/suite | `test/golden/inputs/*`, `test/golden/refs/*`, `test/golden/manifest.json`, `test/golden/suite.test.ts` | T6 | [x] |
| T8 | Regenerate parity, 0-regression check, finalize journal + memory | `test/corpus/parity.json`, `test/corpus/PARITY.md`, decision-journal.md, project memory, comparison pages | T7 | [x] |

## Gate after batch
`npm run typecheck && npm test && npm run build` exit 0; byte-match increased;
**0 per-id regressions**; every target case's verdict recorded; comparison pages
for any case that remains deep (e.g. a residual layout diff) updated/closed.
