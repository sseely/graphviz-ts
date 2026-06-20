# Batch 4 — Full-corpus regression sweep + close

The decisive gate: the change touches the shared non-adjacent flat path. Judge by
per-id verdict deltas (memory `bucket-fix-rebucketing`), not bucket totals.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | Curated goldens + corpus survey (zero new diverges; 74 cnt=1 flats unchanged); oracle restore; findings + memory + summary | direct (opus) | `plans/nonadjacent-flat-multi/findings-regression.md`, `test/corpus/parity.json` (if changed), memory | T3 | [ ] |

Gate: `vitest run` 0 failures, zero out-of-family flips; `survey.ts` zero new
diverged/structural verdicts vs `main` baseline (per-id); C oracle restored native.
