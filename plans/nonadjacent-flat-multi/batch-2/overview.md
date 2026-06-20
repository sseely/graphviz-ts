# Batch 2 — Group router module (the core fix)

Create the faithful cnt-loop router + non-adjacent group collection in a new module
(AD-2), unit-tested directly against re-captured native `dot` oracle splines.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | `splines-flat-multi.ts`: `collectNonAdjacentFlatGroup` + `routeFlatEdgeGroupFaithful` (top+bottom cnt-loop) + unit tests vs oracle | direct (opus) | `src/layout/dot/splines-flat-multi.ts`, `src/layout/dot/splines-flat-multi.test.ts` | T1 | [ ] |

Gate: `tsc` clean; the new tests byte-match re-captured native `dot` for cnt=2/cnt=3
(top) + cnt=2 (bottom); `vitest run` still 1995+ green; `lizard` clean; files <500.
