# Batch 3 — Regenerate + finalize

Depends on ALL of Batch 2. Single task.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| T11 | Regenerate parity, verify 0 regressions, finalize | `test/corpus/parity.json`, `test/corpus/PARITY.md`, journal, memory | B2 | [x] |

**Done (2026-06-21):** byte-match 237→245 (+8), structural 196→219 (+23);
37 per-id improvements, **0 regressions**. parity.json/PARITY.md regenerated
(commit 7ace78c). All deep cases have comparison pages. Gate green.

See [T11-regenerate.md](T11-regenerate.md).

## Gate after batch
`npm run typecheck && npm test && npm run build` exit 0; byte-match increased;
0 per-id regressions; every deferred case has a comparison page referenced in the
journal.
