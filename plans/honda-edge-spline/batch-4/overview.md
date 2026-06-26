# Batch 4 — Revert instrument, validate, commit

Single sequential task. Depends on T3's passing fix.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | Revert C instrument; clean oracle; full survey 0-regression; refresh baselines; commit + merge | orchestrator | C revert, `parity*.json`, `PARITY.md`, agent-note, commits | T3 | [x] |

Exit criterion: clean oracle rebuilt; `survey:gate` PASS with honda-tokoro edge
paths matched and **0 regressions** on both baselines; baselines + PARITY.md
refreshed; fix + `chore(corpus)` commits on `fix/honda-edge-spline`, `--no-ff`
merged to `main` locally. **User pushes.**

Note (regression check): a graph staying "diverged" with a shifted maxΔ is NOT a
verdict regression — confirm via direct node/edge-position delta vs native that
the fix moves toward C (the prior mission's 2471/2796 method), and judge by
per-id verdict per `[[Bucket-fix re-bucketing]]`.
