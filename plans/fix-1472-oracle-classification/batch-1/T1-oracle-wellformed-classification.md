# T1 — classify a non-well-formed oracle as `oracle-error`

## Context

graphviz-ts is a faithful TypeScript port of C graphviz. This task touches only
the **parity survey harness** (`test/corpus/`), not `src/`. The survey renders
each corpus input through native `dot` (the oracle) and the port, then compares
the two SVGs with `compareSvg` (`test/golden/compare.ts`), which normalizes both
via `normalizeSvg` (`test/golden/normalize.ts:148`).

For `tests/1472.dot` (a Google-Autofuzz adversarial input), native `dot` emits
*invalid XML* — invalid UTF-8 bytes from the input propagate into native's
output. `normalizeSvg(oracle)` throws; `diffVerdict` (survey.ts:294-309) catches
any throw and returns `verdict: 'diverged', firstDiffPath: '<compare-threw>'`,
which wrongly implies the **port** diverged. The port's own SVG is well-formed.

The harness already has an `oracle-error` verdict (excluded from port scoring),
but `surveyOne` only reaches it when `oracle.svg === undefined` — i.e. the oracle
timed out or produced no `</svg>` (survey.ts:213-218, 324). A non-empty but
non-well-formed oracle slips through. See `../decisions.md#ad-1`.

## Task

1. **Add an exported pure helper** to `test/corpus/survey.ts`:
   ```ts
   /** True iff `svg` is well-formed enough for compareSvg to normalize it. */
   export function isWellFormedSvg(svg: string): boolean {
     try { normalizeSvg(svg); return true; } catch { return false; }
   }
   ```
   Import `normalizeSvg` from `../golden/normalize.js` (sibling of the existing
   `../golden/compare.js` import at survey.ts:22).

2. **Use it in `surveyOne`** (survey.ts, immediately after the existing
   `if (oracle.svg === undefined) return { ...meta, verdict: 'oracle-error', ... }`
   line, ~324):
   ```ts
   if (!isWellFormedSvg(oracle.svg)) {
     return { ...meta, verdict: 'oracle-error',
       errMsg: `oracle not well-formed XML: ${oracle.svg.length}B` };
   }
   ```
   Keep the message factual and PII-free (no raw oracle bytes — they may contain
   the invalid UTF-8). Place it BEFORE the port render + `diffVerdict` call so a
   known-unusable oracle short-circuits.

3. **TDD unit tests** in `test/corpus/survey.test.ts` (create). Use vitest
   (`describe`/`it`/`expect`, matching repo style). Cover:
   - a minimal well-formed SVG → `isWellFormedSvg` returns `true`;
   - a 1472-style malformed SVG (unbalanced tags, e.g. `<svg><g></svg>`) →
     returns `false`;
   - empty string → `false`.
   Write the tests FIRST, watch them fail against a stub, then implement.

## Write-set

- `test/corpus/survey.ts` (modify)
- `test/corpus/survey.test.ts` (create)

## Read-set

- `test/corpus/survey.ts:22` (import style), `:98-104` (`Verdict` type),
  `:205-218` (`oracleSvg`), `:294-309` (`diffVerdict`), `:320-337` (`surveyOne`)
- `test/golden/normalize.ts:148-163` (`normalizeSvg` — throws on no-root /
  malformed)
- `../decisions.md#ad-1`

## Architecture decisions (locked)

- Fix at the oracle-usability site in `surveyOne`, not in `diffVerdict` and not a
  per-file quarantine. Parse only the ORACLE — never gate on the port SVG here
  (a bad port SVG must still surface as `diverged`/`errored`).
- Reuse `normalizeSvg` (same parser as `compareSvg`) — do not hand-roll a
  well-formedness check.

## Interface contract

`isWellFormedSvg(svg: string): boolean` — pure, no I/O, no throw. Consumed by
`surveyOne` and the unit tests.

## Acceptance criteria

- Given a well-formed SVG string, when `isWellFormedSvg` is called, then it
  returns `true`.
- Given an unbalanced/malformed SVG string, when `isWellFormedSvg` is called,
  then it returns `false` (no throw).
- Given an oracle SVG that fails `normalizeSvg`, when `surveyOne` runs, then the
  result verdict is `oracle-error` and `diffVerdict`/`compareSvg` is not invoked
  for that input.
- Given a well-formed oracle, when `surveyOne` runs, then behaviour is unchanged
  (still routes to `diffVerdict`).

## Observability

N/A — dev/test harness, no new observable production operation.

## Rollback

Reversible — revert the branch. No migration.

## Quality bar

`npx tsc --noEmit` clean; `npx vitest run test/corpus/survey.test.ts` green.
Return only the structured result — no preamble or trailing summary.

## Commit

`fix(T1): classify non-well-formed oracle SVG as oracle-error`
