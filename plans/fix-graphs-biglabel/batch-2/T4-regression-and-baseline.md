# T4 — regression + parity baseline refresh

## Context

After T3, regenerate the committed parity baseline via the frozen recipe
(memory `parity-json-recipe-estimate-ghl`) and verify graphs-biglabel improved
with zero collateral regressions across the 789-corpus (AD-4). Mirrors the T2
recipe used in the fix-1472 mission.

## Task

1. `npm run survey:setup` (idempotent; builds `/tmp/ghl`).
2. Snapshot current per-id verdicts from committed `parity.json` (for delta
   discipline). Run `npm run survey` — if the npm script's bare `tsx` fails
   (`command not found`), run via the npx-cached tsx with `TSX_BIN` set (see
   decisions.md AD-1 note). Regenerates `parity-rules.json`.
3. `npm run survey:gate` — must exit 0 (0 regressions, 0 clip-regressions).
4. Delta discipline (memory `bucket-fix-rebucketing`): diff old vs new by id.
   - `graphs-biglabel` verdict improved: `diverged → conformant` (or
     `structural-match` per AD-3).
   - **No other id regressed** (moved to a worse bucket). If any did → STOP.
5. Promote: `cp test/corpus/parity-rules.json test/corpus/parity.json`, then
   `tsx test/corpus/dashboard.ts` to regenerate `PARITY.md`.
6. If the fix path is golden-covered, add/update the golden fixture for
   biglabel per repo golden conventions.

## Write-set
- `test/corpus/parity.json`, `test/corpus/parity-rules.json`
- `test/corpus/PARITY.md`
- any biglabel golden fixture the fix path warrants

## Read-set
- `package.json` survey scripts; `test/corpus/rules-gate.ts` (gate semantics)
- committed `test/corpus/parity.json` (graphs-biglabel entry + counts)
- memory `parity-json-recipe-estimate-ghl`, `bucket-fix-rebucketing`

## Architecture decisions (locked)
- AD-3 done-bar; AD-4 regression guard.

## Interface contract
Consumes: T3 fix live. Produces: refreshed parity artifacts; a per-id delta
showing exactly one improved id (graphs-biglabel) and no regressions.

## Acceptance criteria
- Given the regenerated baseline, when reading `parity.json`, then
  `graphs-biglabel` is `conformant` (or `structural-match` per AD-3) and no
  longer `firstDiffPath: svg/g[1]/g[5]/path[1]/@d`.
- Given old vs new results diffed by id, then only `graphs-biglabel` improved
  and no id regressed.
- Given `npm run survey:gate`, when run, then exit 0.

## Observability
N/A — generated test artifacts.

## Rollback
Reversible — `git checkout` the JSON/MD artifacts and re-run the survey.

## Quality bar
`survey:gate` exit 0; per-id delta shows exactly one improved id and zero
regressions. Return only the structured result.

## Commit
`chore(T4): refresh parity baseline — graphs-biglabel diverged→conformant`
