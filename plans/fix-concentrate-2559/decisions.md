# Architecture Decisions — fix-concentrate-2559

All three approved by the user during planning (2026-06-27).

## ADR-1: Faithful C port, not a special-case

**Status:** Accepted

**Context:** The merged-trunk geometry comes from C's `make_regular_edge`
`hackflag`/`spline_merge` branch (`dotsplines.c:1718-1873`). The port's chain
router currently breaks at `splineMerge(vn)` (`edge-route-chain.ts:290`) without
emitting the trunk.

**Decision:** Port C's `spline_merge` trunk-routing branch faithfully so it
generalizes to all merge shapes. Do **not** hand-roll a 2-into-1 special case.

**Consequences:** Lower regression risk on b69/other merges; the change tracks
the spec (CLAUDE.md "C is sacred"). Slightly more code to port than a special
case.

## ADR-2: Reference + survey oracle = headless dot 15.1.0, fresh cache

**Status:** Accepted

**Context:** Committed `parity.json` was generated with dot **15.1.0** (headless
`GVBINDIR`). Local dot is 15.0.0. Oracle-cache version skew is a documented
false-diff hazard (memory: `concentrate-arrowhead-done`,
`make-edge-pairs-trunc-fix`).

**Decision:** Generate `concentrate-2559.svg` and run all survey verification
against the headless **15.1.0** oracle built by `npm run survey:setup`
(`GVBINDIR=/tmp/ghl`), with a **fresh/isolated** oracle cache. Never diff against
local 15.0.0.

**Consequences:** Reference matches the baseline; survey deltas are real, not
version artifacts. Requires `survey:setup` before any survey run.

## ADR-3: Success bar = structural-match; hard gate = 0 regressions

**Status:** Accepted

**Context:** Native vs port differ in sub-pixel y-rounding (translate `128.5` vs
`128.8`) from the EstimateTextMeasurer cutover — accepted pre-existing drift
unrelated to this bug, so byte-match may be unreachable.

**Decision:** The per-test success bar is 2559 `diverged → structural-match`
(merged trunk present, same element structure, deltas within tolerance). The
**hard mission gate** is `survey:gate` regressions = 0. Pursue byte-match only if
it falls out naturally; do not switch text measurers to force it.

**Consequences:** Realistic, achievable target; no scope creep into the
measurer. b69/b135/167/2087/b62/b71/2825 must stay unchanged.
