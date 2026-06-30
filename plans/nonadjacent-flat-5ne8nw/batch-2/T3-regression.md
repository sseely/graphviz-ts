# T3 — Full-corpus regression sweep (the crux)

## Context
T2 implemented the pinned `routeSplines` equivariance fix and flipped the RED test
green. Because the change is in the SHARED box-channel spline fitter — it routes
every multi-rank regular edge and every non-adjacent flat in the library — this
sweep is the decisive gate (AD-4), the highest blast radius of the `#241_0` saga.
Judge by per-id verdict deltas (memory `bucket-fix-rebucketing`), not bucket
totals.

## Task
1. **Curated goldens:** `npx vitest run`. Expect 0 failures. Every curated golden
   BYTE-IDENTICAL except the intended `#241_0` family. Diff the changed set vs the
   branch base (`main`):
   - In-family change (`5:ne->8:nw` knot tail-side + the 0.35pt bbox-top): verify
     it moved TOWARD the oracle; update the golden only if it now matches native C;
     record before/after.
   - ANY out-of-family golden flip ⇒ STOP (fitter regression). Report the case +
     geometry delta; do NOT edit the golden.
2. **Corpus survey (AD-4 — the crux):** `npx tsx test/corpus/survey.ts`. Compare
   new `test/corpus/parity.json` to the `main` baseline (diverged 356; `#241_0`
   structural-match maxDelta 126):
   - `#241_0` must move structural-match→conformant (or strictly smaller maxDelta).
   - ZERO new `diverged` OR `structural-match` (regression) verdicts. (Ignore
     `errored↔timeout` flips on already-failing ids — flaky timing; verify each was
     already failing in baseline.) Any genuine new diverge/regression ⇒ STOP.
   - Record the per-id verdict delta table. Pay special attention to ids with
     non-adjacent flats and multi-rank regular edges (the fitter's heaviest users).
3. **End-to-end confirm:** `npx tsx test/corpus/render-one.ts
   ~/git/graphviz/tests/241_0.dot dot` vs native oracle — `5:ne->8:nw` now
   conforms to (knot at svg x=432) and the whole 241_0 SVG is conformant.
4. **Restore native oracle (AD-5):** no instrumented plugin left in
   `/tmp/gvplugins`; `git -C ~/git/graphviz status` clean.

## Write-set
- `plans/nonadjacent-flat-5ne8nw/findings-regression.md` (Create) — per-id delta
  table, in-family golden before/after, survey net result, oracle restore note.
- Any curated golden in the `#241_0` family that now matches native C (only if it
  strictly moves to the oracle; list each).
- `test/corpus/parity.json` — updated baseline if `#241_0` improves.

Do NOT edit `src/` (implementation is T2). Golden updates allowed only for the
in-family cases that now match the oracle.

## Read-set
- `decisions.md` (AD-4, AD-5); `test/corpus/parity.json`, `survey.ts`,
  `render-one.ts`; memory `bucket-fix-rebucketing`, `oracle-native-not-wasm`,
  `flat-edge-241-is-y-only`

## Acceptance criteria
- `vitest` 0 failures; goldens conformant out-of-family; the equivariance test
  passes (done by T2).
- `parity.json`: `#241_0` conformant (or strictly smaller maxDelta); ZERO new
  diverges/regressions; per-id delta table recorded.
- `#241_0` SVG conforms to native C end-to-end (or the precise residual is
  documented with its oracle delta).
- `lizard` on changed files clean; C oracle restored native.

## Observability / Rollback
N/A offline lib. Reversible. One commit:
`test(spline): regression sweep — #241_0 conformant, 0 new diverges`. Return:
vitest result, the per-id survey delta (esp. `#241_0` before/after), in-family
goldens updated, confirmation zero out-of-family changes + oracle native.

## Mission close (orchestrator, after T3 green)
Run final gates on the full branch; merge `fix/nonadjacent-flat-5ne8nw` → `main`
with a merge commit (preserve per-task IDs). Write the mission summary in README.
Update memory `flat-edge-241-is-y-only` to mark `#241_0` FULLY CLOSED (conformant)
— or document the precise residual if any remains.
