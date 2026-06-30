<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Apply faithful fix at the pinned origin + regression test

## Context
graphviz-ts is a faithful port; C is the spec. Batch 1 pinned the exact routing
stage/line where the port's dot edge splines diverge from C on
`nshare-root_twopi`, and classified it. Read the mechanism artifact in
`decision-journal.md` before starting — it supplies `originFile`, `originLine`,
`cPrimitive`, `bugClass`, and `residuals` (interface contract in
batch-2/overview.md).

## Task
Apply the **minimal faithful fix** at the Batch-1 origin so the port produces the
**same spline control points as C** for the diverging edges. Mirror the exact C
primitive named in the artifact (box construction, endpoint/port handling, the
fitter parameterization, or routing order). Do not rewrite or restructure the
routing pipeline (project `CLAUDE.md`); the change should be a small, targeted
edit at the origin (AD-3).

Target per AD-3: all 58 diverging edges within ±0.01. If Batch 1 classified the
~56 residuals as `shared-cause`, the single fix resolves them. If `independent-
noise` (AD-4), the fix targets the 2 dominant edges and the residuals are handled
in T3 (accept with sign-off + docs); if `mixed`, fix the shared subset and
escalate the irreducible remainder per AD-4.

Add a regression test in the origin module's `*.test.ts` (or the nearest existing
edge-route test) that pins the corrected behavior so the delta cannot silently
return. Prefer asserting the exact C primitive's output at unit level; an
integration test rendering `root_twopi` and asserting `311E->312E` /
`280->586E` control points (count + values within deterministic tolerance) is
acceptable — keep it in `src/layout/dot`. (See `plans/fix-1213-splines/`
`flat.test.ts` for the render-and-pin pattern: assert point count first, then
per-point `toBeCloseTo`.)

## Write-set
- `src/layout/dot/<originFile>.ts` — the single fix (from T1; AD-2)
- `src/layout/dot/<originFile>.test.ts` (or nearest existing edge-route test) —
  regression test

## Read-set
- `decision-journal.md` (mechanism artifact — required)
- The C origin in `~/git/graphviz/lib/dotgen/{dotsplines.c,splines.c}` (the
  `cPrimitive`)
- `src/layout/dot/<originFile>.ts` (full symbol being edited)
- Existing `src/layout/dot/edge-route*.test.ts` / `splines*.test.ts` for test
  patterns/fixtures; `plans/fix-1213-splines/` `flat.test.ts` for the render-pin
  pattern

## Architecture decisions in scope
AD-2 (single origin file), AD-3 (match C control points, full conformance), AD-4
(irreducible residual → stop/report, not silent accept), AD-6 (reversible).

## Acceptance criteria
- **Given** the fix, **when** `~/git/graphviz/tests/nshare/root_twopi.gv` is
  rendered by the port (`GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx
  test/corpus/render-one.ts <input> dot`), **then** `311E->312E` and `280->586E`
  match the oracle within deterministic tolerance (±0.01), and `280->586E` has
  the oracle's control-point count.
- **Given** the same render, **then** the count of edges diverging >0.01 from the
  oracle is 0 (full conformance) OR exactly the residual set Batch 1 flagged as
  irreducible (AD-4), with no new divergers introduced.
- **Given** the regression test, **when** `npx vitest run src/layout/dot`, **then**
  it passes and would fail on the pre-fix code.
- **Given** `npm run typecheck`, **then** exit 0.
- **Given** `npx vitest run src/layout/dot`, **then** all existing edge-route
  tests still pass (no routing regression elsewhere).

## Observability requirements
N/A — no new observable runtime operations.

## Rollback notes
Reversible — revert the commit. No data/schema/API change.

## Quality bar
Minimal targeted edit at the origin; no pipeline rewrite. Return only the diff
summary and the root_twopi spline verification result (edges-over-tolerance count
before/after). No preamble.

## Boundaries
- **Always:** keep the change within the single origin file + its test.
- **Ask first / STOP:** if the fix would require editing a second routing source
  (AD-2 violation), or if matching C needs an irreducible libm/FMA tie-break
  (AD-4) — stop and report with a controlled experiment.
- **Never:** add config knobs, new abstractions, or "improved" routing logic.

## Commit format
`fix(T2): match C dot spline routing for root_twopi (<cPrimitive>)` with a body
explaining the mechanism (why the control points diverged) if the change is
non-obvious.
