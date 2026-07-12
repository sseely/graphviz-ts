# Batch 4 — A1-Drift Class Acceptances

Formalizes the A1-drift class entries (D2) once batch-3's rounds have
converged and the class membership is stable, and documents the class
semantics for future readers of `docs/known-divergences.md`.

## Tasks

| Task | Subject |
|---|---|
| T10 | A1-drift class acceptances (×3 engines) + `docs/known-divergences.md` policy section + report regen |

## Exit criteria

- `docs/known-divergences.md` has an A1-drift policy section covering:
  what the class means, the platform caveat (results can shift across
  JS engine / CPU — this is expected, not a regression), and how
  membership is enumerated (computed from `attribution-<engine>.json`,
  per D2 — not hand-listed).
- All parity reports regenerate clean with the three class entries live.
- Corpus guard tests (extended in T2, batch-1) pass against the final
  class entries.
