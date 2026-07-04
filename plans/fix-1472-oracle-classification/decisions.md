# Architecture Decisions

## AD-1: Classify a non-well-formed oracle as `oracle-error` at the survey site

**Context.** `tests/1472.dot` is a Google-Autofuzz adversarial input. Native
`dot` (15.0 and 15.1) passes its invalid UTF-8 bytes into the SVG output,
producing invalid XML. The port renders well-formed SVG. `compareSvg` throws
normalizing the oracle; `diffVerdict` (survey.ts:301) reports `diverged /
<compare-threw>`, wrongly implying the port diverged. The harness already has an
`oracle-error` bucket (excluded from port scoring) but only reaches it when the
oracle is empty or times out (survey.ts:217, 324) — not when it is non-empty but
malformed.

**Decision.** Add an exported pure helper `isWellFormedSvg(svg): boolean`
(wraps `normalizeSvg` in try/catch) to survey.ts. In `surveyOne`, immediately
after the existing `oracle.svg === undefined` check, if `!isWellFormedSvg(oracle.svg)`
return `verdict: 'oracle-error'` with the parse-failure message. This sits at the
true origin — the point that decides whether the oracle is usable — and covers
both the fresh and cache-hit oracle paths.

**Consequences.**
- 1472 moves `diverged → oracle-error`; parity counts diverged 33→32,
  oracle-error 11→12. Dashboard already excludes oracle-error from scoring.
- Generalizes: any future malformed-oracle input is classified honestly instead
  of blamed on the port.
- Cannot mask a real port bug: the check parses the *oracle* only. A port SVG
  that fails to parse still reaches `compareSvg` and surfaces as `diverged`
  (or the port subprocess fails earlier → `errored`).
- Uses the SAME parser (`normalizeSvg`) that `compareSvg` uses, so "oracle
  pre-validates OK" guarantees `compareSvg` will not throw on the oracle side.

## Rejected options

- **Per-file quarantine** (add 1472 to enumerate.ts `malformed`, mirror
  2782.dot). Per-file, not general; leaves the harness misclassification in place
  for future inputs; requires a comparison-page artifact. Rejected in favour of
  the root fix. (User-selected: harness fix.)
- **Fix in `diffVerdict`'s catch block** (re-parse to attribute blame after the
  throw). Works, but reacts to the symptom (the throw) rather than deciding
  oracle usability up front where empty/timeout is already handled. Less
  faithful to the existing pattern.
- **Lightweight string/regex well-formedness check.** Would drift from what
  `compareSvg` actually accepts; using `normalizeSvg` guarantees consistency.

## Rollback

Reversible — revert the branch. No data migration; parity.json/parity-rules.json
regenerate from the survey. No `src/` or public-API change.
