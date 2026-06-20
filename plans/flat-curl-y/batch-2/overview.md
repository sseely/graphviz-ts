# Batch 2 — fix the isolated curl-Y cause(s)

After Batch 1. T3 depends on T1 + T2. Per AD-4: if both paths SHARE a cause, one
fix; if INDEPENDENT, fix the more isolated one and DEFER the other (one path per
mission); if NEITHER is isolable, STOP.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Fix the isolated curl-Y cause(s) from T1/T2 (faithful port of the C box-Y/spline geometry); add a colocated regression test | opus | `src/layout/dot/splines-flat.ts` (+ `edge-route-faithful.ts` if shared box code) + a colocated `*.test.ts` | T1, T2 | [ ] |

## Decision gate (read T1/T2 journal first)
- `sharesCauseWithT1 == true` -> single fix covering both paths.
- independent, both isolable -> fix the more isolated; log the deferred one as a
  follow-on (do NOT fix both in one task unless trivially shared).
- neither isolable -> STOP per AD-4.

## Stop conditions
Per README. AD-4 (non-isolable), AD-5 (frame artifact), goldens untouched.

## Quality gates
All gates from [../README.md](../README.md). Snapshot `parity.json` before T3's
survey run; require 0 regressions + `241_0` improves (bbox height -> 86;
cardinal `:e->:w` edges land at the oracle Y).
