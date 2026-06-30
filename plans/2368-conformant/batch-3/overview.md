# Batch 3 — Conditional x-NS tie-break + validate & baseline refresh

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T3 | CONDITIONAL: investigate the ~1pt node-x delta; fix only if localized + low-risk, else no-op + document | debugger | `src/layout/dot/flat.ts` (localized ED_dist fix) | T2 | [x] |
| T4 | Validate full survey; assert 2368 conformant (or documented residual) + 0 regressions; refresh baseline | debugger | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md` | T3 | [x] |

**T3 outcome (FIX, not no-op):** the x-delta was NOT the deep 2371 x-NS slack but a
localized missing `ED_dist` MAX-accumulation onto the flat class rep
(flat.c:319-322). Fixed in `flat.ts` (write-set differs from the speculative
`position*.ts`/`ns.ts` — the fix was upstream in flat_edges). 2368 bbox + every
node x now conformant C; survey 0 regressions.

**Residual (documented, AD-3):** ONE edge `376->76` (maxΔ 10.22) — a core
`Pshortestpath` symmetric-box funnel tie-break (C routes translationally-identical
down-boxes as mirror images). Deep core-pathplan, out of labeled-flat scope.
2368: diverged maxΔ65 → structural-match maxΔ10.22 (rules-match).

T3 is conditional (AD-3): run ONLY if 2368 still diverges by the ~1pt x delta
after T1+T2. If the fix is not localized + low-risk (it is the 2371-class x-NS
optimal-face selection), mark T3 a no-op and document the residual — do NOT open
the deep x-NS optimal-face work for 1pt. T4 always runs.
