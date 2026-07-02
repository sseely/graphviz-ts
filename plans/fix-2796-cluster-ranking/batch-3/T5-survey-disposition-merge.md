<!-- SPDX-License-Identifier: EPL-2.0 -->
# T5 — Disposition, survey (as needed), merge

## Task
1. Confirm C tree pristine + oracle stdout byte-verified.
2. Disposition (the mission's deliverable): add ONE
   `accepted-divergences.json` entry for id `2796` — new evidence-backed
   class (suggest `R-oracle-bug` or extend the existing R-oracle family if
   its definition fits): reason = "oracle lays out from an
   acknowledged-broken init_rank recovery state (5 overlapping cluster
   pairs, lost edge 3->16); upstream xfail #2796, draft MR !4849, cf.
   #2471; port output meets the issue's expectations", ref = the
   known-divergences section below + comparisons page. Add the matching
   `docs/known-divergences.md` section (link
   plans/fix-2796-cluster-ranking/comparisons/2796-cluster-ranking.md).
   Keep guard tests green per their own conventions (2796 must still be
   non-conformant in parity for the guard — it is).
3. Survey + rules-gate vs COMMITTED HEAD if Batch 2 ran, or if the guards/
   rules-gate consume the new entry in a way that needs fresh parity
   (check accepted.ts semantics first — scope `parity` entries change the
   DASHBOARD split, not verdicts). 0 regressions; movers explained.
4. Refresh parity/PARITY.md as needed (`cp parity-rules.json parity.json`
   + dashboard.ts) so the accepted-deltas table shows the new class row.
5. Mission summary at the bottom of README.md; final journal rows; memory
   update (lesson: upstream xfail cases = verify-inputs-then-accept, not
   byte-chase).
6. Merge `fix/2796-cluster-ranking` → `main` with a **merge commit**; keep
   the branch. Push only if the user asks.

## Write-set
`test/corpus/{accepted-divergences.json, parity.json, parity-rules.json,
PARITY.md}`, `docs/known-divergences.md`,
`plans/fix-2796-cluster-ranking/**`. Guard-test syncs per their own
documented conventions.

## Acceptance criteria
- Given the new entry, when `npx vitest run test/corpus` runs, then PASS
  (guards accept the still-diverged 2796 as registered).
- Given PARITY.md, when regenerated, then 2796 appears under accepted
  deltas (not tracked gaps) with the honest reason.
- Given the survey (if run), then rules-gate exit 0, 0 regressions.

## Observability / Rollback
Guards + (conditional) survey. Reversible (merge revert).

## Commit(s)
`chore(2796): accept oracle-bug divergence per upstream xfail — verified inputs`
+ merge commit `Merge fix/2796-cluster-ranking: <outcome one-liner>`.
