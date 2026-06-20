# T3 findings — full-corpus regression sweep (the crux)

## Result: #241_0 CLOSED to the oracle; ZERO regressions

The two fixes (T2 curl + the T3 arrow recovery) together move `#241_0`'s targeted
geometry to **byte-match native `dot`**, and the corpus verdict from
**diverged → structural-match**, with **zero new diverges** anywhere.

## Curated goldens (`npx vitest run`)
- **147 files / 1993 tests pass.** The `splines-flat-group.test.ts` xfail tripwire
  is now a normal passing test (`3:sw->2:se` = 7-pt curl, Y-range > 10pt).
- **Zero out-of-`#241_0`-family golden churn** — every other golden byte-identical
  (the suite is all-green with no golden edits required).

## Corpus survey (AD-4 — the crux), per-id delta vs branch baseline
Baseline = `fix/group-adjacent-flats` (`/tmp/parity-baseline.json`):
`diverged 357`. New: `diverged 356`, `structural-match 238` (was 237).

| id | baseline | new | note |
|----|----------|-----|------|
| **241_0** | diverged, maxDelta 126 | **structural-match**, maxDelta 126 | TARGET — moved diverged→match |
| 2743 | errored | timeout | flaky timing on already-failing id (AD-4 excluded) |
| 2782 | errored | timeout | flaky timing on already-failing id (AD-4 excluded) |

- **NEW diverged verdicts (regressions): NONE.**
- **LEFT diverged (improvements): `241_0`.**
- The only non-`241_0` verdict deltas are `errored↔timeout` flips on `2743`/`2782`,
  both already failing (`errored`) in baseline — flaky timing, not geometry (AD-4).

## End-to-end confirm (`render-one` vs native oracle `dot 15.1.0`)
`~/git/graphviz/tests/241_0.dot`, port vs native — **every node position and every
edge path/arrow byte-matches the oracle EXCEPT one unrelated edge:**

- `3:sw->2:se` (the mission target) — **byte-identical** path AND arrowhead:
  `d="M228.98,-10.86C…195.86,-3.95"` + `polygon points="193.93,-1.02 188.21,-9.93 198.24,-6.53 193.93,-1.02"`.
- Cardinal `:e->:w` row (e.g. `3:e->4:w`, `8:e->9:w`) — **byte-identical**
  (the +7.88 up-shift is restored; all nodes byte-match).
- Forward corner `2:ne->3:nw` — **byte-identical** (unchanged, still a 7-pt curl).

### Documented residual (out of scope — NOT this mission)
`241_0` stays `structural-match` (not `byte-match`) due to ONE pre-existing
divergence on a **different** edge:

- `5:ne->8:nw` — a **non-adjacent flat edge** (box-channel routed, spans nodes
  5..8 on the same rank), NOT an adjacent back edge. Its control points differ
  (port `…558,-61.88…` vs oracle `…432,-61.88…`), giving the `maxDelta 126`. This
  also shifts the graph background bbox by 0.35pt (`-82.69` vs `-82.34`).
- This is the **box-channel non-adjacent-flat** routing mechanism, unrelated to the
  adjacent back-edge port-curl this mission targets. It pre-dates this mission
  (baseline `241_0` maxDelta was already 126 from this same edge). Recommend a
  separate mission (non-adjacent flat / box-channel routing).

## Oracle restore (AD-5)
- C source tree untouched: `git -C ~/git/graphviz status` shows no modified C
  files (T1 never rebuilt the instrumented plugin — the mechanism was proven from
  source + the actual fixed port config). `/tmp/gvplugins` is the standard native
  build; the cached oracle (`dot 15.1.0`) is unchanged. Oracle remains ground truth.

## Files
- `src/layout/dot/edge-route-chain.ts` (T2) — `makeFwdEdge` swaps ports (the curl).
- `src/layout/dot/splines-flat.ts` (T3) — `copyFlatArrow` recovers the back-edge
  head arrow.
- `src/layout/dot/splines-flat-group.test.ts` (T2) — xfail tripwire → passing.
- `test/corpus/parity.json` — survey baseline updated (`241_0` diverged→structural-match).
- Throwaway probe `test/diagnostic/probe-arrow.ts` created during diagnosis and
  removed; C instrumentation never applied (AD-5).
