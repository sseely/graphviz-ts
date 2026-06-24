# Batch 2 — Implement + verify

Replace the subgraph-only `anonSeq` with a faithful shared anonymous-id counter,
prove `%N` parity on the fixtures (TDD), then verify the full suite + survey.

The write-set is `src/parser/builder.ts` (+ at most one model file if the counter
must be threaded through node/edge creation that lives outside the builder —
decided by T2).

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Implement shared per-parse counter advanced (in cgraph order) by anon root + anon subgraph + keyless edge; name = `'%'+(2*counter+1)`; replace `anonSeq` | debugger | `src/parser/builder.ts` (+`*.test.ts`) | T2 | [x] |
| T4 | Full verification: tsc, vitest, survey 0-regression diff, anon-title probe on 2475_2 subset | debugger | (remove probes), `decision-journal.md` | T3 | [x] |

## TDD anchor
Unit test in `builder.test.ts`: parse a small `strict digraph { subgraph {a->b}
subgraph {c->d e->f} }` and assert the anon names are exactly the oracle's `%N`
sequence from T1 (e.g. root `%1`, sg1 `%3`, sg2 `%9` given 2 then edges), proving
edges advance the counter and the base/formula are right. Add a nested-subgraph
case.

## Exit criteria
- Port `%N` == native `%N` on all Batch-1 sample inputs.
- `npx tsc --noEmit` clean; `npx vitest run` ≥2266 pass.
- Parity survey: 0 verdict regressions; expect anon-subgraph inputs to improve
  (diverged→structural/byte where naming was the only/first diff).
- Probes removed; `git diff` limited to `builder.ts`, its test, (≤1 model file).
