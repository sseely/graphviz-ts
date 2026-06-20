# T2 — Implement caller-side adjacent-flat grouping

## Context
Faithful TS port of C graphviz. The `#241_0` flat-curl is fully diagnosed and the
ordering is pinned by T1 (`plans/group-adjacent-flats/findings-ordering-contract.md`).
C groups all adjacent flat edges between a node pair into ONE
`make_flat_adj_edges` call (`cnt=N`); the port currently routes each in an
isolated `cnt=1` aux graph (`src/layout/dot/edge-route.ts:297`), so the reversed
`3:sw->2:se` clones FORWARD (straight, size 4) instead of BACK (curl, size 7).
The aux internals already handle `cnt=N` (`makeFlatAdjEdges`/`buildFlatAux`/
`copyFlatSplines` in `splines-flat.ts`) — this is a pure caller-side change.

## Task (turn T1's red test green)
1. Read T1's contract: the in-group sort comparator and the confirmed
   `edges[0]=forward` rule.
2. Add grouping at the dispatch (AD-2). Recommended surgical point:
   `routeFaithfulSidePort` (`edge-route.ts:292`). When the branch
   `sameRank && isFlatAdjacent(g, e)` fires (line 296-298), replace the single
   `makeFlatAdjEdges(g, [e], 1, EDGETYPE_SPLINE)` call with:
   - `const group = collectAdjacentFlatGroup(g, e);` — all UNROUTED adjacent
     same-rank side-port edges sharing the unordered `{tail,head}` pair (both
     directions + parallels), sorted per T1's comparator (forward / min-seq
     first → `group[0]` is the forward edge so `auxt=clone(node2)`).
   - `makeFlatAdjEdges(g, group, group.length, EDGETYPE_SPLINE)` ONCE.
   - Return success if `e.info.spl !== undefined` afterward.
3. Implement `collectAdjacentFlatGroup` (new small helper, same file or a sibling
   `src/layout/dot/` module). It must:
   - Find sibling edges by scanning both endpoints' incident edges for same-rank,
     adjacent (`isFlatAdjacent`), side-port (`hasSidePort`), still-unrouted edges
     with the same unordered pair.
   - Sort to reproduce C's `edges[]` order (T1 comparator).
   - Be pure/deterministic (data-in/data-out) per `~/.claude/rules/testability.md`.
4. Idempotency: `routeDotEdges` (`edge-route.ts:333-342`) iterates every edge and
   skips routed ones (`spl !== undefined`). Confirm `copyFlatSplines` sets `spl`
   on EVERY group member (it iterates `edges[]` via `aux.alg`) so siblings are
   skipped after the group routes — no double-routing, no per-iteration order
   dependence. If a member is somehow not installed, that is a real gap — report,
   do not paper over it.

## Boundaries
- **Always do:** keep the change inside the adjacent-flat-with-ports dispatch;
  reuse `makeFlatAdjEdges` unchanged; keep functions ≤30 lines / CCN ≤10 / ≤5
  params (lizard); preserve C's order via T1's comparator.
- **Never do (AD-3):** modify `makeSimpleFlat`, labeled-flat (`makeFlatLabeledEdge`,
  `makeSimpleFlatLabels`), non-adjacent (`routeFlatEdgeFaithful`), or
  regular/back-edge routing. Do NOT rewrite `buildFlatAux`/`repositionFlatAux`/
  `copyFlatSplines`/`splines.ts`.
- **Stop if:** turning the test green needs aux-internal edits (contradicts AD-2/
  the diagnosis) — report; or an out-of-family golden flips while iterating
  locally (that is T3's gate but if you see it, stop and inspect).

## Write-set
- `src/layout/dot/edge-route.ts` (Edit) — grouping at the side-port dispatch
- optionally one new helper module under `src/layout/dot/` (e.g.
  `flat-group.ts`) for `collectAdjacentFlatGroup` if `edge-route.ts` would exceed
  the 500-line file cap or the function caps.

Do NOT modify test files (T1 owns the red test) except to confirm it now passes.

## Read-set
- `decisions.md` (AD-1, AD-2, AD-3)
- `plans/group-adjacent-flats/findings-ordering-contract.md` (T1 — the order)
- `src/layout/dot/edge-route.ts:235-342` (routeOneEdge, routeForwardEdge,
  routeFaithfulSidePort, routeDotEdges)
- `src/layout/dot/splines-flat.ts:139-166, 244-284` (cloneFlatEdge, buildFlatAux,
  copyFlatSplines, makeFlatAdjEdges, isFlatAdjacent)
- `~/git/graphviz/lib/dotgen/dotsplines.c:344-411` (the C loop being mirrored)

## Interface contract
`collectAdjacentFlatGroup(g: Graph, e: Edge): Edge[]` — returns the ordered group
(`[0]` = forward), each member adjacent/same-rank/side-port/unrouted, including
`e`. `makeFlatAdjEdges(g, group, group.length, EDGETYPE_SPLINE)` installs `spl`
on all members.

## Acceptance criteria
- T1's `splines-flat-group.test.ts` is GREEN (`3:sw->2:se` aux size 7 / matching
  SVG; forward guard still green).
- `npx tsc --noEmit` exit 0; `npx vitest run` 0 failures (full regression is T3,
  but the suite must not error here).
- `lizard` on changed files clean; `git diff --name-only main` within write-set.

## Observability / Rollback
N/A offline lib. Reversible (revert commit). One commit:
`fix(flat): group adjacent flat edges into one aux call (closes #241_0 curl)`.
Body explains why (per `~/.claude/rules/commits.md`, >3 files or non-obvious):
the back edge must clone auxh→auxt in a shared aux to curl; cite the diagnosis.
Return to the orchestrator: the insertion point chosen, whether a helper module
was added, and the green-test confirmation.
