<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: faithful parallel/opposing cross-rank edge corridor routing

## Objective

Make parallel and opposing **cross-rank** edges route through the pathplan
corridor from their own offset endpoints — mirroring C's `make_regular_edge`
(`lib/dotgen/dotsplines.c:1880+`) — instead of the port's current "route one
base spline, then x-shift copies" / `makeStraightEdges` straight-line approach.
The motivating case is `graphs-ldbxtried` (maxΔ 320 but structurally wrong:
parallel edges from inside `cluster0` to outside node `n2` under-segment and
miss the corridor — C 20-pt curve vs port 8-pt near-straight). Same subsystem as
2470's residual `@d`.

**Investigation-first:** Batch 0 pins the exact divergence against an
instrumented C oracle and GATES the fix. Do not edit the router until Batch 0
confirms the root cause and that the fix is contained to the dispatch/route/box
files (not `src/pathplan/`).

## Risk

**HIGH — shared router.** Many graphs currently byte-match *through* the
straight/x-shift path. Expect broad survey churn; the 0-regression survey gate is
the safety net (ADR-2, no feature flag). See [[opposing-edge-spline-divergence]].

## Branch

`fix/parallel-corridor-route` (off `main`).

## Constraints

**Stop conditions** — halt and record in `decision-journal.md`:
- Batch 0 shows the fix needs `src/pathplan/` changes (re-plan; ADR-5).
- Any file outside the declared write-set needs changes and isn't in another
  task's write-set.
- The fix regresses a currently byte/structural-matching corpus input and the
  cause is not immediately obvious (survey 0-regression rule).
- Two consecutive survey/test-gate failures on the same check, or the same
  router location is changed 3× without resolving the same failure.
- A perf regression > 2× native on any corpus input that previously passed.

**Push-forward** (decide and log):
- Exact split of the fix across T1.2–T1.4 (refined by Batch 0 findings).
- Which already-changed goldens are legitimate vs regressions (judge per-id vs
  fresh oracle, not bucket counts — see [[bucket-fix-rebucketing]]).
- Minimal-repro graph shape for the golden.

## Quality gates

Run between/after tasks (definitions in each batch overview):
- `npm run typecheck` → exit 0
- `npm test` → exit 0 (golden suite green; new repro + ldbxtried goldens pass)
- `npm run survey && npm run survey:gate` → **0 regressions**
- `npm run survey:dashboard` → PARITY.md regenerated; ldbxtried flips as predicted

## Batches

| Batch | Tasks | Status |
|---|---|---|
| [batch-0](batch-0/overview.md) — investigation (GATE) | T0.1 C oracle, T0.2 port instrument, T0.3 root-cause+GO/STOP | [x] GO |
| [batch-1](batch-1/overview.md) — faithful per-edge routing | T1.1 golden red, T1.2 representative-resolution fix (0 regr, +13), T1.3/T1.4 N/A | [x] |
| [batch-2](batch-2/overview.md) — verify + baselines | T2.1 survey+perf (gate PASS, 0 regr), T2.2 baseline refresh + close | [x] |

## Mission summary (2026-06-25)

**Status: COMPLETE.** Objective met — parallel/opposing cross-rank edges now route
the pathplan corridor to their real head instead of a straight line to the first
virtual node.

**Root cause (Batch 0, GO):** the parallel/opposing group routed its shared base
from the unresolved first virtual chain segment (`edges[0]`, head = a virtual
node), so `routeRegularEdgeFaithful` treated it as adjacent-rank and emitted a
straight base ending at that vnode, short-circuiting the multi-rank chain router.
Pinned against an instrumented C `make_regular_edge`/`routesplines_` oracle +
a port dispatch probe; **refined ADR-3** (C routes ONE base from un-offset ports,
not per-edge offset ports).

**Fix (Batch 1, T1.2 — `splines-route.ts` only, ~30 LOC):**
- `baseSplineForGroup` resolves the representative to its original edge before
  routing (`resolveOrigEdge`), so the multi-rank chain router walks the corridor.
- `groupRealHead` clips each shifted copy to the real head, not the virtual
  segment head. Mirrors C `make_regular_edge` (realedge resolve + VIRTUAL chain
  walk + `clip_and_install(e, aghead(e))`). `edge-route-faithful.ts` needed no
  change; T1.3/T1.4 were N/A.

**Verification (Batch 2):**
- **Survey gate: PASS, 0 regressions.** Fix's isolated headless effect: `pmpipe`
  ×3 `diverged → structural-match` (maxΔ 68→11) + broad edge-level corridor
  fidelity on parallel/opposing multi-rank edges.
- **Perf clean:** routing-changed graphs render 0.04–0.36× native; the heaviest
  input `2108` is identical 95s pre/post (mincross-bound, unaffected by the fix).
- **Goldens:** `parallel-multirank-min` (cluster-free, byte-exact) pins the fix;
  `parallel-cluster-ldbxtried` is `knownResidual`. Full suite 2404 passed.

**Known residual / follow-up (out of scope — `edge-route.ts`):** `ldbxtried` stays
diverged (maxΔ 323 unchanged): the fix corrects the parallel `n0->n2` edges, but
the worst delta MOVED to the lone `n0->n1` edge — routing the n0->n2 group now
calls `recover_slack`, repositioning shared chain vnodes that the LONE multi-rank
router does not re-route faithfully. Tracked in
`.agent-notes/parallel-corridor-fix-and-lone-recoverslack-followup.md`.

**Harness improvements (user-directed):** survey timeout floor derived as
`5× slowest native` (`survey.ts`, was a fixed 180s — fixed concurrency
false-timeouts on 2108/1718); `npm run survey:fast` (`SURVEY_MAX_PORT_MS`) skips
the >60s tail for routine "did we break anything?" runs.

## Index

- [decisions.md](decisions.md) — ADR-1..5 + operational readiness
- [batch-0/overview.md](batch-0/overview.md) · [batch-1/overview.md](batch-1/overview.md) · [batch-2/overview.md](batch-2/overview.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) · [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Prior art: `.agent-notes/opposing-edge-spline-divergence.md`, memory
  `[[opposing-edge-spline-divergence]]`, `[[recover-slack-and-c-harness]]`
