# T2 — Implement the gated aux back-edge curl fix

## Context
Start on `fix/aux-back-edge-curl` (off `fix/group-adjacent-flats`). T1 pinned the
mechanism and the minimal gate in
`plans/aux-back-edge-curl/findings-curl-mechanism.md`, and verified (throwaway)
that the candidate gate makes the `#241_0` back edge curl (size 7). This task
implements that gate as the real fix and flips the xfail tripwire green.

## Task
1. Read T1's `findings-curl-mechanism.md` — implement EXACTLY the confirmed
   `candidateGate` at the named `portLine`. The likely shape (confirm against
   T1): in `routeOneEdge` (`src/layout/dot/edge-route.ts`), an adjacent-rank back
   edge with `hasSidePort(e)` should NOT be intercepted by
   `routeFaithfulAdjacentBack` — let it fall to the side-port path
   (`routeForwardEdge` → `routeFaithfulSidePort` → `routeRegularEdgeFaithful`)
   that already curls the forward corner edge. Implement whatever T1 proved, not
   this guess if they differ.
2. Keep the gate as NARROW as T1 confirmed (AD-2): port-less straight back edges
   keep their current path; only the side-port (and/or aux) case changes.
3. Flip the tripwire: in `src/layout/dot/splines-flat-group.test.ts`, change the
   `it.fails('XFAIL: …')` back to a normal `it('… 3:sw->2:se back edge is a curl
   — 7 pts AND Y-range > 10pt', …)` — it must now PASS.

## Boundaries
- **Always do:** keep the change minimal and gated per T1; keep functions ≤30
  lines / CCN ≤10 / ≤5 params (lizard).
- **Never do:** change forward-edge routing; change port-less back-edge routing;
  revert/alter the grouping change (AD-3); rewrite `routeRegularEdgeFaithful`'s
  geometry (reuse it).
- **Stop if:** the minimal gate flips out-of-`#241_0`-family curated goldens
  while iterating locally (that is T3's full gate, but if you see it, STOP and
  inspect — it means the gate is too broad).

## Write-set
- `src/layout/dot/edge-route.ts` (Edit) — the gated dispatch change
- `src/layout/dot/splines-flat-group.test.ts` (Edit) — flip xfail → passing

## Read-set
- `decisions.md` (AD-2, AD-3); `plans/aux-back-edge-curl/findings-curl-mechanism.md`
- `src/layout/dot/edge-route.ts` (routeOneEdge, routeFaithfulAdjacentBack,
  routeForwardEdge, routeFaithfulSidePort, hasSidePort)
- `src/layout/dot/edge-route-faithful.ts` (routeRegularEdgeFaithful)

## Acceptance criteria
- `splines-flat-group.test.ts` is GREEN (back edge 7 pts, Y-range > 10pt; forward
  guard still green); the `.fails` marker is removed.
- `npx tsc --noEmit` exit 0; `npx vitest run` 0 failures (full regression is T3,
  but the suite must not error here).
- `lizard` on changed files clean; `git diff --name-only` within write-set.

## Observability / Rollback
N/A offline lib. Reversible. One commit:
`fix(flat): curl adjacent back edges with side ports (closes #241_0)`. Body cites
the diagnosis + the gate (per `~/.claude/rules/commits.md`). Return to the
orchestrator: the exact change, the gate predicate, and the green-test confirmation.
