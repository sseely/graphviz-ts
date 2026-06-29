# T3 — Conditional x-NS tie-break (the ~1pt node-x delta)

## Context

After T1 (geometry) + T2 (vspace), 2368 may still differ by ~1pt in node x
(e.g. node 136 at 255 vs C 256; bbox width 604 vs 608 partly from this). This is
the 2371-class x-coord network-simplex OPTIMAL-FACE selection: the x-LP has
multiple optima and C/port pick different vertices. It is deep and corpus-wide
(see `.agent-notes/2371-is-xcoord-ns-solution-selection.md`). C is the spec.

## Task (CONDITIONAL — AD-3)

1. Re-render 2368 after T1+T2. If it byte-matches, mark T3 **no-op (not needed)**
   and skip to T4.
2. If only a ~1pt x delta remains, instrument the x-NS aux-graph construction
   order / pivot for 2368 vs C (the prior mission's `xns-diff.mjs` harness +
   `set_xcoords` dump are reusable) to find whether a LOCALIZED, low-risk
   ordering fix closes it.
3. Apply the fix ONLY if it is localized and low-risk AND the full survey is 0
   regressions. Otherwise mark T3 **no-op + documented residual** (the x-NS
   optimal-face work is out of scope) and proceed to T4.

Do NOT undertake a general x-NS optimal-face replication for a 1pt residual.

## Write-set
- `src/layout/dot/position.ts` / `position-aux.ts` / `ns.ts` — CONDITIONAL; only
  if a localized fix is found. Otherwise empty (no-op).

## Read-set
- `.agent-notes/2371-is-xcoord-ns-solution-selection.md`
- `test/diagnostic/xns-diff.mjs` + `xns-trace.md` (prior mission harness)
- `src/layout/dot/position-aux.ts` (createAuxEdges / make_LR_constraints order)

## Interface contracts
None.

## Acceptance criteria
- Given 2368 after T1+T2 byte-matches, when T3 starts, then T3 is marked no-op
  (not needed) — no code change.
- Given a ~1pt residual AND a localized low-risk fix, when applied, then 2368
  byte-match AND full survey 0 regressions.
- Given no localized fix, when assessed, then T3 is marked no-op + the residual
  documented in the decision journal — NOT pursued further (AD-3).

## Observability / Rollback
N/A. Reversible.

## Quality bar
If code changes: `tsc` clean, `vitest` green, survey GATE PASS 0 regressions,
commit `fix(xcoord): <localized tie-break> (2368)`. If no-op: a decision-journal
entry, no commit.
