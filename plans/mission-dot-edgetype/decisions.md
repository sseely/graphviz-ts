# Architecture Decisions — dot-edgetype

## AD-1: Dispatch-helper location

**Context:** Four box-corridor emit points (`edge-route-faithful.ts`,
`edge-route-chain.ts` ×2) call `routeSplines(P)` directly. LINE/PLINE need
`routePolylines(P)` + a LINE straighten step.

**Decision:** New module `src/layout/dot/splines-route-type.ts` exporting
`routeRegularByType(P, et)`. It calls `routeSplines`/`routePolylines` and
applies the `EDGETYPE_LINE && pn>4` straighten, faithfully mirroring
`dotsplines.c:1799-1808` / `1849-1861`.

**Consequences:** `common/splines-routespl.ts` stays engine-generic. The
straighten logic lives once, not duplicated at 4 sites. Easier: each call site
becomes a one-line swap. Harder: one more small module.

## AD-2: Port `makeLineEdge` (don't rely on box-straighten alone)

**Context:** The box-path straighten only triggers for adjacent ranks
(`pn>4`). C tries `makeLineEdge` first for `EDGETYPE_LINE`, which draws a direct
tail-port→head-port segment for `delr>1` (and a 7-point segment through the
label position when the edge has a label).

**Decision:** Port `makeLineEdge` (`dotsplines.c:1636`) into
`src/layout/dot/splines-route.ts` and dispatch it before the box path for
multi-rank LINE edges. The labeled 7-point variant is ported too.

**Consequences:** Multi-rank `splines=line` matches C's exact endpoints rather
than a corridor-collapsed approximation. Easier to pin against oracle. The
adjacent-rank LINE case still flows through the box-straighten (C returns 0
from `makeLineEdge` for `delr==1`).

## AD-3: Oracle tolerance (SR4 precedent)

**Context:** `routepolylines` derives from C `routepolylines`, which differs
from the port by libm / Proutespline renormalization at the sub-point level.

**Decision:** Pin `routepolylines`-derived (PLINE) control points at **0.5pt**.
Pin pure straight-line endpoints (LINE 4-pt, `makeLineEdge`) **tight at
0.06pt** — they are exact node-coord + port arithmetic, no spline fit.

**Consequences:** Matches the SR4/T6a tolerance regime already used by the
faithful side-port oracle tests.

## AD-4: Quarantine policy

**Context:** Some `splines` cases may not reach parity within scope (e.g.
ports + line, or a case needing `lib/ortho`).

**Decision:** Any case that cannot reach parity is quarantined with a
comparison page under `plans/mission-dot-edgetype/comparisons/` and referenced
in `decision-journal.md`. Per CLAUDE.md, the mission is not complete while a
quarantined case lacks its comparison page.

**Consequences:** No silent omissions; every divergence is documented.

## Rollback classification

**Reversible.** Pure library layout code; revert the commits. Goldens are
unaffected (no golden sets `splines`), so there is no migration and no
risk to existing rendered output.
