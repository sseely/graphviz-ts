# T3 — Full-corpus regression sweep (the crux)

## Context
T2 implemented the gated aux back-edge curl fix and flipped the xfail tripwire
green. Because the change is in core back-edge routing (affecting every
adjacent-rank back edge), this sweep is the decisive gate (AD-4). Judge by per-id
verdict deltas (memory `bucket-fix-rebucketing`), not bucket totals.

## Task
1. **Curated goldens:** `npx vitest run`. Expect 0 failures. Every curated golden
   BYTE-IDENTICAL except the intended `#241_0` adjacent-flat family. Diff the
   changed set vs the branch base:
   - In-family change (the `#241_0` curl + dependent `:e->:w` up-shift): verify it
     moved TOWARD the oracle; update the golden only if it now matches native C;
     record before/after.
   - ANY out-of-family golden flip ⇒ STOP (back-edge regression). Report the case
     + geometry delta; do NOT edit the golden.
2. **Corpus survey (AD-4 — the crux):** `npx tsx test/corpus/survey.ts`. Compare
   new `test/corpus/parity.json` to the branch baseline (diverged 357; `#241_0`
   diverged maxDelta 126):
   - `#241_0` must move `diverged`→matches (or strictly smaller maxDelta).
   - ZERO new `diverged` verdicts. (Ignore `errored↔timeout` flips on
     already-failing ids — flaky timing, not geometry. Verify each such id was
     already failing in baseline.) Any genuine new diverge ⇒ STOP.
   - Record the per-id verdict delta table.
3. **End-to-end confirm:** `npx tsx test/corpus/render-one.ts
   ~/git/graphviz/tests/241_0.dot dot` vs native oracle — the `3:sw->2:se` path
   and the cardinal `:e->:w` row now match (curl + +7.88 up-shift restored).
4. **Restore native oracle (AD-5):** no instrumented plugin left in
   `/tmp/gvplugins`; `git -C ~/git/graphviz status` clean.

## Write-set
- `plans/aux-back-edge-curl/findings-regression.md` (Create) — per-id delta
  table, in-family golden before/after, survey net result, oracle restore note.
- Any curated golden in the `#241_0` family that now matches native C (only if it
  strictly moves to the oracle; list each).

Do NOT edit `src/` (implementation is T2). Golden updates allowed only for the
in-family cases that now match the oracle.

## Read-set
- `decisions.md` (AD-4, AD-5); `test/corpus/parity.json`, `survey.ts`,
  `render-one.ts`; memory `bucket-fix-rebucketing`, `oracle-native-not-wasm`,
  `flat-edge-241-is-y-only`

## Acceptance criteria
- `vitest` 0 failures; goldens byte-identical out-of-family; the `#241_0` xfail
  is now a normal passing test (done by T2).
- `parity.json`: `#241_0` improved; ZERO new diverges; per-id delta table recorded.
- `#241_0` SVG matches native C for `3:sw->2:se` and the `:e->:w` row (or the
  precise residual is documented with its oracle delta).
- `lizard` on changed files clean; C oracle restored native.

## Observability / Rollback
N/A offline lib. Reversible. One commit:
`test(flat): regression sweep — #241_0 curl closed, 0 new diverges`. Return:
vitest result, the per-id survey delta (esp. `#241_0` before/after), in-family
goldens updated, confirmation zero out-of-family changes + oracle native.

## Mission close (orchestrator, after T3 green)
Run final gates on the full branch; merge `fix/aux-back-edge-curl` →
`fix/group-adjacent-flats` → `main` with **merge commits** (preserve per-task
IDs). Write the mission summary in README. Update memory `flat-edge-241-is-y-only`
to mark `#241_0` CLOSED (or document the precise residual).
