<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: faithful single-pass edge routing order

## Objective

Route lone and parallel/opposing-group edges in C's **single `edgecmp`-ordered
pass** instead of the port's two passes (all groups via `dotSplines_`, then all
lone edges via `routeDotEdges`). The two-pass split makes every group's
`recover_slack` vnode move — and every group's installed spline (read by
`top_bound`/`bot_bound`) — visible to lone edges that C routes *earlier*,
corrupting them. Motivating case: `graphs-ldbxtried` lone `n0->n1` (C dispatch
pos 30) reads the rank-1 vnode `%0` of the `n0->n2` group (pos 85) AFTER the
port has already moved it (967→789), giving a 4-pt straight instead of C's 7-pt
corridor.

**Root cause is already pinned** (see `comparisons/` prior art /
`.agent-notes/parallel-corridor-fix-and-lone-recoverslack-followup.md`,
memory `[[parallel-corridor-route-done]]`): `recover_slack` is byte-faithful;
the miss is **routing ORDER**. Proven: port with `recoverSlack` disabled
byte-matches C's 7-pt `n0->n1`.

**Investigation-first:** Batch 0 pins C's exact `edgecmp` order against an
instrumented oracle and verifies the port's `edgecmp` reproduces it. Do not
touch the router until T0.3 records GO and confirms containment to the
dispatch files.

## Risk

**HIGH — shared router, order-sensitive.** 395 graphs byte-match through the
two-pass structure. Unifying the pass changes the order in which every lone edge
sees (a) `recover_slack`-moved vnodes and (b) neighbors' installed splines
(`top_bound`/`bot_bound`). Expect broad survey churn; the 0-regression survey
gate (ADR-2, no feature flag) is the safety net.

## Branch

`fix/edge-route-order` (off `main`). A `fix/lone-edge-recoverslack` branch exists
from the investigation (clean, no commits) — reuse or rebrand.

## Constraints

**Stop conditions** — halt and record in `decision-journal.md`:
- Batch 0 shows the fix needs changes beyond `splines.ts`/`edge-route.ts`
  dispatch (e.g. `routeRegularEdgeFaithful`, `recoverSlack`, or `edge-order.ts`
  comparator *semantics* beyond trivial alignment) → re-plan (ADR-5).
- The port's `edgecmp` does NOT reproduce C's order and aligning it needs
  non-trivial comparator changes → STOP.
- A file outside the declared write-set needs changes and isn't in another
  task's write-set.
- The fix regresses a byte/structural-matching input and the cause is not
  immediately obvious (0-regression rule).
- Two consecutive gate failures on the same check, or the same dispatch location
  changed 3× without resolving the same failure.
- A perf regression > 2× native on a previously-passing input.

**Push-forward** (decide and log):
- Exact T1.2 split; whether T1.3 (`edge-order.ts` alignment) is needed.
- Which already-changed goldens are legitimate vs regressions (per-id vs fresh
  oracle — see `[[bucket-fix-rebucketing]]`).
- Minimal-repro graph shape (a lone edge sharing a vnode with a later-`edgecmp`
  group).

## Quality gates

- `npm run typecheck` → exit 0
- `npm test` → exit 0 (repro + ldbxtried goldens pass)
- `npm run survey && npm run survey:gate` → **0 regressions**
  (fast iteration: `npm run survey:fast` skips the >60s tail)
- `npm run survey:dashboard` → PARITY.md regenerated; ldbxtried flips as predicted

## Batches

| Batch | Tasks | Status |
|---|---|---|
| [batch-0](batch-0/overview.md) — investigation (GATE) | T0.1 C order oracle, T0.2 port order divergence, T0.3 root-cause+GO/STOP | [x] **GO** |
| [batch-1](batch-1/overview.md) — unify the pass | T1.1 golden red, T1.2 single edgecmp pass, T1.3 comparator align (conditional) | [ ] |
| [batch-2](batch-2/overview.md) — verify + baselines | T2.1 survey+perf, T2.2 baseline refresh + close | [ ] |

## Index

- [decisions.md](decisions.md) — ADR-1..5 + operational readiness
- [batch-0/overview.md](batch-0/overview.md) · [batch-1/overview.md](batch-1/overview.md) · [batch-2/overview.md](batch-2/overview.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) · [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Prior art: `.agent-notes/parallel-corridor-fix-and-lone-recoverslack-followup.md`
  (ROOT CAUSE PINNED), memory `[[parallel-corridor-route-done]]`,
  `[[recover-slack-and-c-harness]]`, `[[instrument-c-before-quarantine]]`
