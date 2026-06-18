# Batch 2 — apply the routed parity-preserving fix

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|-----------|------|
| T2 | Apply the fix to the routed cause + unit tests (parity-preserving) | routed file(s) of {`mincross-cross.ts`,`mincross-order.ts`,`mincross-utils.ts`,`fastgr.ts`} + `*.test.ts` | T1 | [ ] |
| T3 | Conditional: apply a second material axis if T1 flagged one | as T2 (different site) | T2 | [ ] |

T2→T3 sequential (T3 may be skipped). T3 exists only if T1's routing names a
second, independent material cost.

## Routing (filled by T1)

- Dominant cause: `<a pass-count | b non-convergence | c constant-factor>`
- Target site(s): `<function + lines>`
- Second axis (T3), if any: `<… or "none">`

## Fix shape by cause (AD-5 — match C, don't improve on C)

- **(a) pass-count** — align TS `transpose`/`transposeStep` candidate-flag and
  `delta` accounting with C exactly so the loop converges in C's pass-count.
  Parity check: final order unchanged.
- **(b) non-convergence** — find why TS `delta` stays ≥1 where C terminates
  (candidate re-marking, reverse-tie accounting, `valid`-cache interaction);
  mirror C. **If the fix would change swap legality/order → STOP and re-plan**
  (that risks AD-1).
- **(c) constant-factor** — reuse buffers (module/ctx-level `Count`/`list`
  mirroring C's `TI_list`), drop the per-pair `[0,0]` allocation, hoist repeated
  `info.*` access into locals. Pure mechanical equivalence.

## Mandatory parity check (every T2/T3 commit)

1. Oracle order-probe diff == C on mc3 + the mid-size benchmark (reuse T1
   baseline; revert probe after).
2. `npx vitest run` → all pass, **zero golden churn**.
3. Record the transpose speedup factor vs the pre-fix bundle in the journal.

## Unit tests

Lock the equivalence the fix relies on: e.g. per-swap delta from a reused buffer
equals the prior per-call value; or pass-count parity on a small fixture.
