# T2 — SFDP-1: wire beautifyLeaves + oracle pin

## Context

T1 ported `beautifyLeaves`. C calls it per multilevel level
(`spring_electrical.c:378`); the TS equivalent is the `throw` at
`spring-electrical.ts:356` inside `springElectricalEmbedding`.

## Task

1. Replace the throw with:
   `if (ctrl.beautifyLeaves) beautifyLeaves(dim, A, x);`
   using the symmetrized `A` in scope (AD-3: no diagonal).
2. Flip the beautify guard in `guards.test.ts`: `beautify="true"` no longer
   throws; assert it renders and at least one leaf moved.
3. Add an e2e oracle-pin test in `spring-electrical.test.ts` (or
   `sfdp.test.ts` style): the ring+2-leaves graph (README), `beautify=true`,
   assert every node's `n.info.pos` matches the README ground truth to 6
   digits (`toBeCloseTo(_, 6)`), mirroring the existing `SIMPLE_ORACLE_POS`
   test.

## Write-set

- `src/layout/sfdp/spring-electrical.ts`
- `src/layout/sfdp/spring-electrical.test.ts`
- `src/layout/sfdp/guards.test.ts`

## Read-set

- `src/layout/sfdp/spring-electrical.ts:291-358` (springElectricalEmbedding, throw)
- `src/layout/sfdp/guards.test.ts:82-100` (current guard)
- `src/layout/sfdp/sfdp.test.ts:129-153` (oracle-pin pattern)
- `../README.md` (oracle ground truth) · `decisions.md#ad-4`

## Acceptance criteria

- Given the ring+2-leaves graph with `beautify=true`, when laid out, then
  every node `n.info.pos` matches the README oracle to 6 digits.
- Given `beautify="true"` on any graph, when laid out, then it does NOT
  throw.
- Given `npx vitest run`, then ≥ 1858 pass (T1 unit + T2 oracle/guard),
  zero churn in unrelated sfdp goldens.

## Observability / Rollback

N/A. Reversible — revert the commit.

## Comparison page

`comparisons/sfdp-1-beautify.md`: input, oracle ND_pos, port output, 6-digit
verdict. Reference in the journal.

## Commit

`feat(T2): wire beautifyLeaves into sfdp, drop the throw (SFDP-1)`
