# Batch 1 — enumerate, survey, dashboard

Single batch, **sequential** (T2 needs T1's manifest; T3 needs T2's verdicts).
All write-sets are disjoint *new* files under `test/corpus/`, but the data
dependency forces order.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Enumerate the corpus; classify dot-applicable vs quarantined (with reasons) | opus | `test/corpus/enumerate.ts`, `test/corpus/corpus-manifest.json` (generated), `test/corpus/README.md` | — | [x] |
| T2 | Isolated render worker + survey runner; classify byte/structural/diverged/errored/timeout; emit `parity.json` | opus | `test/corpus/render-one.ts`, `test/corpus/survey.ts` | T1 | [x] |
| T3 | Dashboard from `parity.json`; triage divergences into counted buckets = next-mission backlog; link from port-catalog | opus | `test/corpus/PARITY.md` (generated), `test/corpus/dashboard.ts`, `plans/port-catalog/README.md` | T2 | [ ] |

## Reuse (read-only)

- `test/golden/compare.ts` — `compareSvg(actual, ref, toleranceClass, override?)
  → {pass, diffs}`. `diffs[]` carry `delta` (numeric) or none (structural).
  Byte-match = pass at `deterministic` (0.01). Structural-match = fails byte but
  diffs are all numeric (no missing/extra nodes). Diverged = any structural diff.
- `test/golden/normalize.ts` — `normalizeSvg`.

## Stop conditions

STOP and wait for human input when:
- A task needs to modify `test/golden/manifest.json` or `suite.test.ts`
  (contradicts AD-1).
- A task starts editing `src/` to close a divergence (contradicts AD-5).
- The survey cannot complete because subprocess isolation is insufficient (mass
  hangs the runner itself) — report rather than loosen isolation unsafely.
- A fix needs a file outside the task's declared write-set.
- 2 consecutive quality-gate failures on the same check.
- The same code location is changed 3× without resolving the same failing check.

## Push-forward with judgment when:

- Dashboard layout / bucket naming is stylistic — pick a clear form and proceed.
- The corpus root has a few odd files (symlinks, empty, `.gv.gz`) — classify
  them `quarantined: non-graph` and move on; log the count.
- A hook limit forces splitting a helper — split it, log the split.
- An input is borderline between two quarantine reasons — pick the dominant one
  and record it.

## Quality gates

Run all gates from [../README.md](../README.md) after each task. The survey
meta-gate (`npx tsx test/corpus/survey.ts` exits 0 + writes `parity.json`)
applies from T2 on. Log gate results in `decision-journal.md`.
