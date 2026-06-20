# T3 — Full regression sweep (golden-risk guard)

## Context
T2 implemented caller-side adjacent-flat grouping. The aux path serves ALL
adjacent flats, so the prior 4 `#241_0` missions feared golden-risk and never
landed the fix. This task makes that fear an explicit pass/fail gate (AD-4) and
records per-id verdict deltas (memory `bucket-fix-rebucketing`: judge by per-id
deltas, not bucket counts).

## Task
1. **Curated goldens:** `npx vitest run`. Expect 0 failures. Every curated golden
   BYTE-IDENTICAL **except** the intended `#241_0` adjacent-flat family. Diff the
   failing/changed set against `main`:
   - In-family change (the `#241_0` curl + its dependent `:e->:w` up-shift) ⇒
     verify it moved TOWARD the oracle; update the golden only if it now matches
     native C; record the before/after.
   - ANY out-of-family golden flip ⇒ STOP (shared-aux regression). Report the
     case + the geometry delta; do not "fix" by editing the golden.
2. **Corpus survey (AD-4):** `npx tsx test/corpus/survey.ts`. Compare the new
   `test/corpus/parity.json` to the baseline (`#241_0` = `diverged`, maxDelta
   126; ~796 entries):
   - `#241_0` verdict must move `diverged`→matches (or strictly smaller maxDelta).
   - ZERO new `diverged` verdicts anywhere. Any new diverge ⇒ STOP.
   - Record the per-id verdict delta table (every id whose verdict or maxDelta
     changed), not just totals.
3. **Confirm the mechanism end-to-end:** `npx tsx test/corpus/render-one.ts
   ~/git/graphviz/tests/241_0.dot dot` vs the native oracle — the red `3:sw->2:se`
   path and the cardinal `:e->:w` edges now match (the +7.88 up-shift restored).
4. **Restore native oracle (AD-5):** ensure no instrumented C plugin remains in
   `/tmp/gvplugins`; `git -C ~/git/graphviz status` clean; the survey ran against
   the clean native binary.

## Write-set
- `plans/group-adjacent-flats/findings-regression.md` (Create) — the per-id
  verdict delta table, the in-family golden before/after, the survey net result.
- Any curated golden file in the `#241_0` family that now matches native C (only
  if it strictly moves to the oracle; list each in the findings).

Do NOT edit `src/` (implementation is T2). Golden-data updates are allowed only
for the in-family cases that now match the oracle.

## Read-set
- `decisions.md` (AD-4, AD-5)
- `plans/group-adjacent-flats/findings-ordering-contract.md` (T1)
- `test/corpus/parity.json` (baseline), `test/corpus/survey.ts`,
  `test/corpus/render-one.ts`
- memory `bucket-fix-rebucketing`, `oracle-native-not-wasm`,
  `flat-edge-241-is-y-only`

## Acceptance criteria
- `npx vitest run` 0 failures; goldens byte-identical out-of-family.
- `parity.json`: `#241_0` improved; zero new diverges; per-id delta table recorded.
- The `#241_0` SVG matches native C for `3:sw->2:se` and the `:e->:w` row (or the
  precise residual that remains is documented with its oracle delta and a
  follow-up note).
- `lizard` on any changed files clean; C oracle restored native (verified).
- `git diff --name-only main`: `src/` shows only T2's files (unchanged by T3);
  golden changes are in-family only.

## Observability / Rollback
N/A offline lib. Reversible. One commit:
`test(flat): regression sweep — #241_0 curl closed, 0 new diverges`. Return to
the orchestrator: vitest result, the per-id survey delta (esp. `#241_0`
before/after), any in-family goldens updated, and confirmation zero out-of-family
goldens changed + oracle native.
