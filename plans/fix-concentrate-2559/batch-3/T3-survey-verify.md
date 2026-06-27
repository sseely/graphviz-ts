# T3 — Survey verification + comparison page

## Context

T2 ported the concentrate merged-trunk routing and added the 2559 golden + unit
test. This task proves the change across the whole corpus: 2559 must flip
`diverged → structural-match` (ADR-3) with **zero regressions**, and a comparison
page must exist and be referenced in the decision journal (CLAUDE.md gate).

The committed baseline `test/corpus/parity.json` was generated with the **headless
dot 15.1.0** oracle. Oracle-cache version/skew is a known false-diff hazard
(memory: `concentrate-arrowhead-done`) — always use a **fresh/isolated** cache
after a code change, and verify any apparent regression by rendering port vs the
headless 15.1.0 `dot` directly.

## Task

Run the corpus survey against the headless 15.1.0 oracle with an isolated cache,
**verify** the 2559 flip and 0 regressions, write the comparison page, and refresh
the committed baseline. Critically inspect the known concentrate cases
(b69, b135, 167, 2087, b62, b71, 2825) — they must be unchanged.

## Read-set

- `comparisons/T1-investigation.md`, `comparisons/` (T2 outputs)
- `test/corpus/survey.ts`, `test/corpus/rules-gate.ts`,
  `test/corpus/gen-headless-gvbindir.sh`, `test/corpus/PARITY.md`
- Pre-change baseline: `git show HEAD~?:test/corpus/parity.json` for the diff

## Method

1. `npm run survey:setup` (builds headless 15.1.0 `GVBINDIR=/tmp/ghl`).
2. Run the survey with a **fresh/isolated** oracle cache (per
   `concentrate-arrowhead-done`: default cache is namespaced by
   `sha1(DOT_BIN,GVBINDIR,mtime)`; force-clear if reused). Capture before/after.
3. `npm run survey:gate` → assert `regressions = 0`.
4. For each of b69/b135/167/2087/b62/b71/2825: confirm verdict unchanged; if any
   moved, render port vs `GVBINDIR=/tmp/ghl dot` directly to prove real vs skew.
5. Write the comparison page with before/after verdict + maxDelta for 2559 and
   the watched set, and the survey count delta.
6. Refresh `test/corpus/parity.json` + `test/corpus/PARITY.md` to the post-fix
   state.

## Write-set

- `plans/fix-concentrate-2559/comparisons/T3-survey-verify.md` (create)
- `test/corpus/parity.json` (refresh)
- `test/corpus/PARITY.md` (refresh)

## Acceptance criteria

- Given the fix, when the survey runs against a fresh 15.1.0 cache, then 2559's
  verdict is `structural-match` (was `diverged`).
- Given `survey:gate`, when run, then `regressions = 0`, explicitly evidenced for
  b69/b135/167/2087/b62/b71/2825 (verdict unchanged).
- Given any apparent regression, when investigated, then it is proven a cache/skew
  artifact by a direct port-vs-headless-15.1.0 render — otherwise STOP.
- Given the CLAUDE.md gate, when complete, then `comparisons/T3-survey-verify.md`
  exists and is referenced in `decision-journal.md`.

## Architecture decisions

- ADR-2 (15.1.0 headless oracle, fresh cache) and ADR-3 (structural-match bar,
  0-regression hard gate) apply. See [decisions.md](../decisions.md).

## Observability

N/A — verification only. The corpus survey *is* the correctness signal.

## Rollback

Reversible. Refreshes test baselines + adds a doc; revert restores prior
baseline.

## Boundaries

- **Never:** mark the task done with a non-zero regression count; diff against
  local dot 15.0.0; hand-edit `parity.json` to mask a result.
- **Always:** use the headless 15.1.0 oracle + isolated cache; prove any verdict
  movement is real or skew before proceeding.

## Commit

`test(T3): verify concentrate-2559 fix; refresh corpus parity baseline`
