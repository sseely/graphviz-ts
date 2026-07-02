<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Faithful fix at the mechanism origin(s)

## Context
T1 produced `.agent-notes/1332-edge-routing-diagnosis.md` with
`classification: port-defect` and `fixLocus`. The C source is the spec —
port the C behavior exactly at the origin; no compensating tweaks
downstream (diagnosis.md scope-of-change).

## Task
1. Read the mechanism artifact. If `fixLocus` ⊄ this task's write-set:
   interactive write-set expansion ASK (decisions.md#d3) before editing.
2. Implement the faithful fix at each `mechanism.origin` (cite `@see` C
   file:line). No 1332 special cases; the fix must be the general C
   behavior. Separate mechanisms → separate commits.
3. Add a mechanism-capturing unit test per fix (fix-sensitive: red without,
   green with — verify by stashing the fix once).
4. Gate: render 1332, per-element compare (title-keyed) vs oracle.

## Write-set (PROVISIONAL — expansion via interactive ask)
- `src/layout/dot/edge-route-faithful.ts`, `src/layout/dot/splines-route*.ts`,
  `src/layout/dot/edge-route-chain.ts`
- matching `.test.ts` files

## Read-set
- `.agent-notes/1332-edge-routing-diagnosis.md` (the spec for this task)
- The C function(s) named in the mechanism origins
- `plans/fix-1332-cluster-edge-routing/decisions.md#d3`

## Acceptance criteria
- Given the fix, when 1332 is per-element compared, then the 4 geometry
  edges (`c3378:Out0->c4046:In1`, `c6428:Out0->c6753:In0`,
  `c6412->c6414:In0`, `c4256->c4258:In0`) are 0-differing and nodes stay 0.
- Given the diff, when reviewed, then changes trace to mechanism origins
  (spread across symptom sites = stop and re-diagnose).
- Given `npx tsc --noEmit` / `npx vitest run` / goldens, then 0 / pass / pass.
- Given lizard caps (file 500 / CCN 10 / params 5), then no new violations.

## Observability / Rollback
N/A — library layout code; gates are the observability. Reversible.

## Commit
`fix(dot): <mechanism, one line> — 1332 cluster-edge corridors` (body:
mechanism summary + C refs; references T2)
