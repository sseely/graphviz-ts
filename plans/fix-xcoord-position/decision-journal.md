# Decision journal — text-measurement architecture

Appended during execution. One row per non-trivial judgment call.

| When | Batch/Task | Decision | Rationale |
|------|-----------|----------|-----------|
| 2026-06-24 | (pre) | Re-scope: this is a text-measurement architecture mission, not an x-coord fix | Investigation+spike (DESIGN.md §2) proved layout rules are faithful; divergence is font measurement |

## Settled up-front (from DESIGN.md review)
- Corpus migration: side-by-side then cut over (ADR-3).
- Hinted LUT: demote to internal fallback (ADR-4).
- Node no-canvas fallback: EstimateTextMeasurer + warning that advises installing
  the canvas package (ADR-5).

## Batch tallies (fill in during execution)
```
B0 rules survey: <N> byte-exact / <M> allowlisted pre-existing / <K> FAIL
B1 browser-bundle canvas-free: pass/fail
B2 measurement unit tests: <counts>
B3 full-corpus rules cutover: <N> exact / <M> allowlisted
```
