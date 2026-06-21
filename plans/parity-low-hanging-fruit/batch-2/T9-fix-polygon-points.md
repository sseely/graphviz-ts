# T9 — Fix polygon-points simple cases

Follow the shared fix methodology in [overview.md](overview.md). Read
`triage/polygon-points.md` first. Depends on T8.

## Task
Implement each confirmed-simple polygon-points root-cause group (e.g. arrowhead
or node-shape vertex coordinate/rounding). One commit per group; one golden per
group. A vertex-COUNT difference is likely **deep** (shape geometry) — defer with
a comparison page; a coordinate/rounding difference may be simple.

`144_no_ortho`/`144_ortho` likely share a cause — fix once, verify both.

## Write-set
- The poly/arrow module named in the triage doc (likely `src/render/poly-gencode.ts`
  or an arrow module under `src/common/`) + its test
- golden add (per group)
- `plans/parity-low-hanging-fruit/comparisons/<id>.md` (per deferred case)

## Acceptance criteria
- Given each simple case, when fixed, then its `@points` first-diff is resolved
  and byte-matches the oracle.
- Given a count-difference case, then it is deferred with a comparison page.
- Given the golden suite, then green; 0 per-id regressions.

## Observability / Rollback
N/A. Reversible.

## Quality bar
`npm run typecheck && npm test` exit 0. Commit(s): `fix(<scope>): <cause> (parity)`.
