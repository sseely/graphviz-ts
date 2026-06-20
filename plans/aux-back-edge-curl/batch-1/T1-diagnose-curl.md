# T1 — Diagnose the aux back-edge curl mechanism (no fix)

## Context
Faithful TS port of C graphviz (`~/git/graphviz` = spec). Start on
`fix/aux-back-edge-curl` (off `fix/group-adjacent-flats`). The `#241_0` flat
curl is half-fixed: edge grouping landed (the 2↔3 flats route through one cnt=3
aux call), but the reversed `3:sw->2:se` clone STILL routes straight (aux size 4)
where C curls it (size 7). Grouping/order/`otn` are ruled out
(`plans/group-adjacent-flats/findings-second-divergence.md`). This task pins the
EXACT remaining mechanism — no `src/` edit.

## The pinned-but-unconfirmed lead
In the aux graph `auxt`(rank0)/`auxh`(rank1) are cross-rank, so the back-edge
clone `auxh->auxt` is a regular adjacent-rank BACK edge. The port routes it via
`routeOneEdge` → `routeFaithfulAdjacentBack` (guard `tr===hr+1`) →
`makeFwdEdge` → `routeRegularEdgeFaithful` → straight (size 4), seemingly
ignoring the `sw/se` corner ports. The forward corner edge `auxt->auxh`
(`2:ne->3:nw`) curls (size 7) via the side-port path. **Confirm or refute** that
this dispatch asymmetry is the cause, and identify WHY C curls.

## Task
1. **Instrument C `make_regular_edge`** (ephemeral, AD-5) for the `#241_0` 2↔3
   aux back-edge clone. Print: is the back edge handled as a multi-edge (cnt>1 in
   the aux) or singly? Does the curl come from (a) the corner ports driving the
   spline (beginpath/endpath box), (b) multi-edge spread across the parallel
   aux edges, or (c) back-edge-specific box-channel handling? Dump the back
   edge's resolved ports + the spline control points + size. Rebuild
   `gvplugin_dot_layout` → `/tmp/gvplugins`; run on `~/git/graphviz/tests/241_0.dot`.
   **Restore clean** + verify `git -C ~/git/graphviz status` clean (AD-5).
2. **Instrument the PORT** (temporary, reverted) on the SAME aux back edge: add a
   tracer in `routeOneEdge`/`routeFaithfulAdjacentBack`/`routeRegularEdgeFaithful`
   (or use `test/diagnostic/flat-aux-dump.ts`) to confirm the back edge enters
   `routeFaithfulAdjacentBack`, and capture what `routeRegularEdgeFaithful`
   returns for it (point count, whether ports were honored). Compare to the
   forward corner edge's path through `routeFaithfulSidePort`.
3. **Name the mechanism + the minimal gate.** State precisely: why C curls and
   the port doesn't, the exact port line, and the narrowest fix gate (candidate:
   "in `routeOneEdge`, an adjacent-rank back edge with `hasSidePort(e)` should
   take the side-port path instead of `routeFaithfulAdjacentBack`" — confirm this
   actually yields the curl, or name the real fix). If the curl is multi-edge
   spread (not ports), say so — the fix differs entirely.
4. **Sanity-test the candidate gate WITHOUT committing a fix:** if feasible, make
   a throwaway one-line change in a scratch copy / behind a temporary probe to
   verify the back edge curls (size 7) under the proposed gate, then REVERT it.
   This is the AD-1 "run the actual config before declaring sufficiency" step —
   the lesson that cost the prior mission. Report the observed back-edge size
   under the candidate gate.

## Write-set
- `plans/aux-back-edge-curl/findings-curl-mechanism.md` (Create) — the C+port
  dumps, the named mechanism, the confirmed minimal gate, and the observed
  back-edge size under the candidate gate (from the throwaway test).

Do NOT commit any `src/` change in this task. C instrumentation ephemeral.

## Read-set
- `decisions.md` (AD-1, AD-5); `plans/group-adjacent-flats/findings-second-divergence.md`
- `src/layout/dot/edge-route.ts` — `routeOneEdge`, `routeFaithfulAdjacentBack`,
  `routeForwardEdge`, `routeFaithfulSidePort`, `hasSidePort`, `makeFwdEdge`
- `src/layout/dot/edge-route-faithful.ts` — `routeRegularEdgeFaithful`
- `src/layout/dot/edge-route-chain.ts` — `makeFwdEdge`, `routeBackEdge`
- `~/git/graphviz/lib/dotgen/dotsplines.c:make_regular_edge` (adjacent back edge
  with ports), `beginpath`/`endpath` port handling
- `test/diagnostic/flat-aux-dump.ts`

## Interface contract (consumed by T2)
```
{ mechanism: "ports"|"multiedge-spread"|"boxchannel"|other,
  whyCCurls: string, whyPortStraight: string,
  portLine: string,                 // exact file:symbol to change
  candidateGate: string,            // the minimal predicate
  backSizeUnderGate: number,        // observed (must be 7) from the throwaway test
  gateConfirmed: boolean }          // true ⇒ T2 can implement; false ⇒ STOP
```

## Acceptance criteria
- `findings-curl-mechanism.md` names the single mechanism with C+port dumps, the
  exact port line, the minimal gate, and the throwaway-test back-edge size (==7
  expected) under that gate.
- `gateConfirmed` is explicitly true/false; if false, STOP with the reason.
- `npx tsc --noEmit` exit 0; `git diff --name-only` (vs branch base) shows only
  the findings file; C source restored clean.

## Boundaries
- ZERO committed `src/` edits. Throwaway probes must be reverted before finishing.
- If you cannot pin ONE mechanism, STOP and report (do not guess — the saga's
  recurring failure).
- If a build/hook blocks you twice, STOP and report where.

## Commit
One commit: `docs(diag): aux back-edge curl mechanism + minimal gate`.
Return: the interface-contract JSON (esp. `mechanism`, `portLine`,
`candidateGate`, `backSizeUnderGate`, `gateConfirmed`), and C-restore confirmation.
