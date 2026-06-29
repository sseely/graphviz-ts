# Batch 3 — Conditional x-NS tie-break + validate & baseline refresh

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T3 | CONDITIONAL: investigate the ~1pt node-x delta; fix only if localized + low-risk, else no-op + document | debugger | `src/layout/dot/position*.ts` / `ns.ts` (conditional) | T2 | [ ] |
| T4 | Validate full survey; assert 2368 byte-match (or documented residual) + 0 regressions; refresh baseline | debugger | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md` | T3 | [ ] |

T3 is conditional (AD-3): run ONLY if 2368 still diverges by the ~1pt x delta
after T1+T2. If the fix is not localized + low-risk (it is the 2371-class x-NS
optimal-face selection), mark T3 a no-op and document the residual — do NOT open
the deep x-NS optimal-face work for 1pt. T4 always runs.
