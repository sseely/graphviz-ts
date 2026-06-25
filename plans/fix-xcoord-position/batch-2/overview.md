# Batch 2 — Bundled-font measurement tests

| Task | Writes | Gate |
|------|--------|------|
| [T2.1 bundled-font tests](T2.1-bundled-tests.md) | test/fonts/*, test helpers, devDeps | kern/ligature/charset unit tests pass, cross-platform deterministic |

Gate: conjured-from-bundled-font tables match the font's own tables; covers the
Latin1/Symbol charset and ligature cases. Independent of the layout corpus.
