# T4 — Survey verification + baseline refresh

## Context

T2/T3 ported the dot `doDot` pack branch (+ clusters). This task proves it across the
corpus: 2458 must flip `diverged → match` (ADR-5) with **zero regressions**, the
comparison page must exist and be referenced in the decision journal (CLAUDE.md
gate), and the committed baseline must be refreshed.

`parity.json` is the Estimate-measurer + headless-15.1.0 baseline (NOT LUT/pango —
memory `parity-json-recipe-estimate-ghl`). Oracle-cache skew is a known false-diff
hazard; the native binary is unchanged, so the cache is consistent — but verify any
apparent regression by rendering port vs headless 15.1.0 directly.

## Task

1. `npm run survey:setup` (builds headless 15.1.0 `GVBINDIR=/tmp/ghl`).
2. Run the survey: `GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx
   test/corpus/survey.ts` (NOT `npm run survey` — tsx not on PATH). Capture before/after.
3. `npx tsx test/corpus/rules-gate.ts` → assert `regressions = 0`.
4. Confirm 2458 → match. Identify all pack/multi-component graphs the fix newly
   activates; for any verdict move, render port vs `GVBINDIR=/tmp/ghl dot` directly
   to prove real vs skew (improvements OK, regressions STOP).
5. Build the full baseline→post-fix verdict transition matrix; flag any
   `byte→structural` or `→diverged` downgrades and justify (sub-pixel tolerance, or
   not-caused-by-this-change with evidence).
6. Write the comparison page (2458 + watched set before/after, transition matrix,
   count delta).
7. Refresh: `cp test/corpus/parity-rules.json test/corpus/parity.json` then
   `npx tsx test/corpus/dashboard.ts` (regenerates PARITY.md from parity.json).

## Read-set

- `comparisons/T1-investigation.md`, T2/T3 outputs
- `test/corpus/survey.ts`, `test/corpus/rules-gate.ts`, `test/corpus/dashboard.ts`,
  `test/corpus/gen-headless-gvbindir.sh`
- Pre-change baseline: `git show HEAD~?:test/corpus/parity.json` for the diff

## Write-set

- `plans/fix-pack-dot-2458/comparisons/T4-survey-verify.md` (create)
- `test/corpus/parity.json` (refresh)
- `test/corpus/PARITY.md` (refresh)

## Acceptance criteria

- Given the fix, when the survey runs against a fresh 15.1.0 cache, then 2458's
  verdict is `match` (byte or structural; was `diverged`).
- Given `rules-gate.ts`, when run, then `regressions = 0`, with the transition matrix
  evidenced and every downgrade justified.
- Given any apparent regression, when investigated, then it is proven cache/skew or
  not-this-change by a direct port-vs-headless-15.1.0 render — otherwise STOP.
- Given the CLAUDE.md gate, when complete, then `comparisons/T4-survey-verify.md`
  exists and is referenced in `decision-journal.md`.

## Boundaries

- **Never:** mark done with non-zero regressions; diff against local dot 15.0.0;
  hand-edit `parity.json` to mask a result; refresh parity.json with LUT/non-ghl
  (clobbers it — memory `parity-json-recipe-estimate-ghl`).
- **Always:** headless 15.1.0 oracle + fresh cache; prove any verdict move real/skew.

## Observability / Rollback

N/A — verification only. Reversible (revert restores prior baseline).

## Commit

`test(T4): verify pack-dot-2458 fix; refresh corpus parity baseline`
