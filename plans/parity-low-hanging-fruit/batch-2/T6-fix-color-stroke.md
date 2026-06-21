# T6 — Fix color-stroke simple cases

Follow the shared fix methodology in [overview.md](overview.md). Read
`triage/color-stroke.md` first.

## Seed fix (verified, do this first)
**Hex colors emitted verbatim → lowercase.** `src/render/color-resolve.ts` emits
`#hex` specs verbatim (its header notes `#FF0000` is passed through); graphviz
canonicalizes to lowercase `#rrggbb`. Normalize `#hex` input to lowercase on the
resolve/emit path (route it through the channel-parse → `rgbaStr`, which already
lowercases, OR `.toLowerCase()` the validated `#rrggbb[aa]` form). Keep
non-`#hex` specs (named colors, raw HSV, unresolved schemes) verbatim as today.

Verify against C: `~/git/graphviz/lib/common/colorprocs` / `colxlate` — output is
lowercase hex. Cite in a JSDoc `@see`.

## Task
Implement the seed fix + any OTHER confirmed-simple color-stroke groups from the
triage doc (e.g. default-fill, gradient). One commit per root-cause group. Add
one golden per group (the hex-case golden's representative: pick a small case
like `1896` or a minimal synthetic). Defer deep cases with a comparison page.

## Write-set
- `src/render/color-resolve.ts` (modify) + `src/render/color-resolve.test.ts`
- `test/golden/inputs/<id>.dot`, `test/golden/refs/<id>.svg`,
  `test/golden/manifest.json`, `test/golden/suite.test.ts` (golden add)
- `plans/parity-low-hanging-fruit/comparisons/<id>.md` (per deferred case)

## Acceptance criteria
- Given a `#RRGGBB`-uppercase input, when rendered, then the SVG fill is
  lowercase `#rrggbb`, byte-matching the oracle.
- Given `1896`, then its first-diff (`polygon[1]/@fill`) is resolved.
- Given the golden suite, then it is green with the new color golden(s); 0 per-id
  regressions vs the prior survey.

## Observability / Rollback
N/A. Reversible (revert the commit(s)).

## Quality bar
`npm run typecheck && npm test` exit 0. Commit(s):
`fix(color): lowercase hex color output (parity)` (+ one per extra group).
