# Batch 3 — Regenerate + finalize

Depends on ALL of Batch 2. Single task.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| T11 | Regenerate parity, verify 0 regressions, finalize | `test/corpus/parity.json`, `test/corpus/PARITY.md`, journal, memory | B2 | [ ] |

See [T11-regenerate.md](T11-regenerate.md).

## Gate after batch
`npm run typecheck && npm test && npm run build` exit 0; byte-match increased;
0 per-id regressions; every deferred case has a comparison page referenced in the
journal.
