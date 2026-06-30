# T8 — Fix attr-or-tag simple cases

Follow the shared fix methodology in [overview.md](overview.md). Read
`triage/attr-or-tag-1.md` and `-2.md` first. Depends on T7.

## Task
Implement each confirmed-simple attr-or-tag root-cause group. Prioritize shared
causes that clear whole families (e.g. the cross-platform `*-arrows_dot`,
`*-root_circo/twopi`, `*-triedds` families — one fix may clear many). One commit
per root-cause group; one golden per group. Defer deep cases (comparison page).

The fix module varies per cause (per triage) — usually under `src/render/`
(svg attribute emission) or `src/common/` (arrowheads, shapes). Keep each change
localized and faithful to C.

## Write-set
- The module(s) named in the triage docs + their tests
- golden add (per group)
- `plans/parity-low-hanging-fruit/comparisons/<id>.md` (per deferred case)

## Acceptance criteria
- Given each simple group, when fixed, then the affected cases' first-diff is
  resolved and conforms to the oracle.
- Given a cross-platform family with one root cause, then one fix clears the
  family (verify each member).
- Given the golden suite, then green; 0 per-id regressions.

## Observability / Rollback
N/A. Reversible.

## Quality bar
`npm run typecheck && npm test` exit 0. Commit(s): `fix(<scope>): <cause> (parity)`.
If a fix would touch >1 module or exceed the simple cutoff, reclassify as deep
and defer (STOP condition).
