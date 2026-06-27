# Batch 3 — Survey verification + comparison page

Single task, one commit. Proves the fix flips 2559 with zero corpus regressions
and produces the mandatory comparison page (CLAUDE.md gate).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Survey (fresh 15.1.0 cache); confirm 2559→structural-match, 0 regressions; comparison page; refresh baseline | general-purpose (Sonnet) | `plans/fix-concentrate-2559/comparisons/T3-survey-verify.md`, `test/corpus/parity.json`, `test/corpus/PARITY.md` | T2 | [ ] |

The 0-regression `survey:gate` result is the hard mission gate. A confirmed real
regression is a STOP condition.
