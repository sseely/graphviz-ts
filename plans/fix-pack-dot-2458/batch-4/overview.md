# Batch 4 — Survey verification + baseline refresh

Proves the change across the corpus: 2458 (and any clustered pack case) flips to
match with zero regressions, writes the comparison page, and refreshes the committed
baseline. Depends on T2 + T3.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | survey vs headless 15.1.0 (fresh cache); verify 2458 match + 0 regressions; comparison page; refresh parity.json + PARITY.md | (inline / general) | `plans/fix-pack-dot-2458/comparisons/T4-survey-verify.md`, `test/corpus/parity.json`, `test/corpus/PARITY.md` | T2, T3 | [ ] |
