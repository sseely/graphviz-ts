# T2 — Faithful fix + golden + unit test (TDD)

## Context

graphviz-ts is a faithful TS port of C Graphviz (`~/git/graphviz` = spec). T1 has
pinned the exact location where the port drops the concentrate merged-trunk
segment for corpus 2559. The merge itself (`conc.ts`/`classify.ts`) is correct
and **must not be touched**. The fix ports C's `spline_merge` trunk-routing
branch (`dotsplines.c:make_regular_edge`, ≈1718-1873) into the chain router so a
merged virtual node (`in.size>1 || out.size>1`) emits the shared trunk.

**Read T1's findings first:** `comparisons/T1-investigation.md` — its trailing
interface block gives `fixFile`, `fixSymbol`, `divergenceLine`, `trunkAssertion`,
`oracleCmd`.

## Task

Port the C `spline_merge` trunk-routing behavior at the location T1 pinned, so
2559's `c->b` renders as a 2-segment shared trunk that `d->b` joins, matching
native. Apply TDD: add the golden + unit test that fails first (Red), then make
the minimal faithful change to pass (Green). Preserve C's branch structure and
order of operations exactly (CLAUDE.md); note any unavoidable deviation in a code
comment with `@see lib/dotgen/dotsplines.c:make_regular_edge`.

## Read-set

- `comparisons/T1-investigation.md` (interface block — the source of `fixFile`)
- `<fixFile>:<divergenceLine ±40>` from T1
- C: `~/git/graphviz/lib/dotgen/dotsplines.c:1718-1873` (`make_regular_edge`
  hackflag/`spline_merge` branch) and `spline_merge` (≈108)
- `test/golden/refs/concentrate-167.svg`, `test/golden/inputs/concentrate-167.dot`
  — the established concentrate golden pattern to mirror
- An existing `src/layout/dot/*.test.ts` near the fix file for the test idiom

## Write-set

- `<fixFile>` from T1 (expected `src/layout/dot/edge-route-chain.ts`); at most 2
  sibling routing files (`splines-route.ts`, `edge-route-faithful.ts`) IF T1's
  findings require it — no other `src/` files
- `test/golden/inputs/concentrate-2559.dot` (create — copy of
  `~/git/graphviz/tests/2559.dot`)
- `test/golden/refs/concentrate-2559.svg` (create — from the **headless 15.1.0**
  oracle via T1's `oracleCmd`, ADR-2; NOT local dot 15.0.0)
- one `src/layout/dot/*.test.ts` (create or extend) asserting `trunkAssertion`

## Architecture decisions (locked)

- ADR-1: faithful C port, no special-case. ADR-2: 15.1.0 headless oracle for the
  reference. ADR-3: structural-match is the bar; do not chase conformant by
  changing measurers. See [decisions.md](../decisions.md).

## Interface contract

**In (from T1):** `{ fixFile, fixSymbol, divergenceLine, trunkAssertion,
oracleCmd }`.
**Out (→T3):** `{ goldenInput: test/golden/inputs/concentrate-2559.dot,
goldenRef: test/golden/refs/concentrate-2559.svg, testFile, commitSha }`.

## Acceptance criteria

- Given 2559 rendered before the fix, when the new unit test runs, then it fails
  (Red) because the merged trunk is absent.
- Given the faithful `spline_merge` trunk port, when 2559 is rendered after, then
  `c->b` emits the 2-segment trunk and `d->b` joins it, satisfying
  `trunkAssertion` (test Green).
- Given the reference, when generated, then `concentrate-2559.svg` was produced
  by the headless 15.1.0 oracle (ADR-2).
- Given the change, when `npx tsc --noEmit --stableTypeOrdering` and
  `npx vitest run` run, then both exit 0 with no other test regressed.
- Given the diff, when `git diff --name-only` is checked, then it lists only the
  declared write-set (no `conc.ts`/`classify.ts`).

## Observability

N/A — no new observable runtime operations.

## Rollback

Reversible. Single code commit; revert restores prior routing. No migration.

## Boundaries

- **Never:** edit `conc.ts`/`classify.ts`; add a special-case that doesn't track
  the C branch; widen the write-set beyond T1's `fixFile` + ≤2 named siblings;
  switch text measurers to force conformant.
- **Ask first:** if the fix needs a 4th source file or a file outside the three
  routing files — STOP (write-set / stop condition).
- **Always:** keep the per-rank box-corridor routing faithful; cite the C line in
  a `@see` comment for any non-obvious ported branch.

## Quality bar

`npx tsc --noEmit --stableTypeOrdering` exit 0; `npx vitest run` exit 0 with the
new 2559 test green. Watch the complexity hook (lizard: file ≤500 lines, CCN ≤10,
params ≤5) — `??` counts toward CCN.

## Commit

`fix(T2): route concentrate merged-trunk via spline_merge for 2559`

Body (>3 files): explain the C `make_regular_edge` `spline_merge` branch being
ported and why the merge detection (`conc.ts`) was already correct.
