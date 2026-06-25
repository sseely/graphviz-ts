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
| [batch-1](batch-1/overview.md) — faithful per-edge routing | T1.1 golden red, T1.2 offset-port route, T1.3 straight-edges, T1.4 boxes | [ ] |
| [batch-2](batch-2/overview.md) — verify + baselines | T2.1 survey+perf, T2.2 baseline refresh + close | [ ] |

## Index

- [decisions.md](decisions.md) — ADR-1..5 + operational readiness
- [batch-0/overview.md](batch-0/overview.md) · [batch-1/overview.md](batch-1/overview.md) · [batch-2/overview.md](batch-2/overview.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) · [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Prior art: `.agent-notes/opposing-edge-spline-divergence.md`, memory
  `[[opposing-edge-spline-divergence]]`, `[[recover-slack-and-c-harness]]`
