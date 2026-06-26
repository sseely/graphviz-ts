# Batch 4 — Revert instrument, validate, commit

Single sequential task. Depends on T3's passing fix.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | Revert C instrument; clean oracle; full survey 0-regression; refresh baselines; commit + merge | orchestrator | C revert, `parity*.json`, `PARITY.md`, agent-note, commits | T3 | [x] |

Exit criterion: clean oracle rebuilt; `survey:gate` PASS with honda-tokoro
matched and **0 regressions** on both baselines; baselines + PARITY.md
refreshed; fix + `chore(corpus)` commits on `fix/xcoord-ns-degeneracy`,
`--no-ff` merged to `main` locally. **User pushes.**
