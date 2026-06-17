# Batch 3 — Oracle parity + corpus (after T2, T3)

Single task. With newrank terminating and `c` installed once, verify the layout
matches the oracle and flip the residual test to parity pins. If parity needs
further faithful fixes, apply within AD-3's cap (≤3 total) or rescope.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | newrank oracle parity + small corpus; flip residual pins | opus | `src/layout/dot/newrank.test.ts`, any final faithful fix within AD-3 | T2, T3 | [ ] |

Commit: `feat(T4): newrank reaches dot oracle parity (cross-cluster rank=same)`.
After the gate passes, the orchestrator merges `feature/dot-newrank-2` → `main`
with a merge commit (or rescopes with a comparison page if AD-3's cap is hit).
