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
conforms to C's 7-pt `n0->n1`.

**Investigation-first:** Batch 0 pins C's exact `edgecmp` order against an
instrumented oracle and verifies the port's `edgecmp` reproduces it. Do not
touch the router until T0.3 records GO and confirms containment to the
dispatch files.

## Risk

**HIGH — shared router, order-sensitive.** 395 graphs conformant through the
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
| [batch-1](batch-1/overview.md) — unify the pass | T1.1 golden red, T1.2 single edgecmp pass, T1.3 comparator align (conditional) | [x] |
| [batch-2](batch-2/overview.md) — verify + baselines | T2.1 survey+perf, T2.2 baseline refresh + close | [x] |

## Index

- [decisions.md](decisions.md) — ADR-1..5 + operational readiness
- [batch-0/overview.md](batch-0/overview.md) · [batch-1/overview.md](batch-1/overview.md) · [batch-2/overview.md](batch-2/overview.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) · [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Prior art: `.agent-notes/parallel-corridor-fix-and-lone-recoverslack-followup.md`
  (ROOT CAUSE PINNED), memory `[[parallel-corridor-route-done]]`,
  `[[recover-slack-and-c-harness]]`, `[[instrument-c-before-quarantine]]`

---

## Mission Summary — 2026-06-25 ✅ COMPLETE

### Tasks completed vs planned

All 6 tasks completed (T1.3 N/A as planned):

| Task | Status | Key result |
|---|---|---|
| T0.1 C order oracle | ✅ | ldbxtried dispatch: lone n0→n1@pos34, group n0→n2@pos67; C %0 vnode moves |
| T0.2 Port divergence | ✅ | Two-pass deferral confirmed; port edgecmp positional-exact to C |
| T0.3 Root-cause + GO | ✅ | GO: lone-edge pass-2 deferral is the bug; contained to splines.ts+edge-route.ts |
| T1.1 Red goldens | ✅ | Focused `n0→n1` assertion (RED: 8 nums vs 14); green guard `edge-order-min` |
| T1.2 Single-pass unify | ✅ | `dispatchEdgeGroup` routes lone edge in-place; `routeDotEdges` is skip-backstop |
| T1.3 Comparator align | ✅ N/A | Port edgecmp == C; no comparator change needed |
| T2.1 Survey + perf | ✅ | Gate PASS: 0 regressions, 17 headless improvements, focused golden GREEN |
| T2.2 Baselines + close | ✅ | Pango baseline: conformant 346→359 (+13), structural-match 265→252 (-13) |

### Verdict deltas (pango baseline)

| Before T1.2 | After T1.2 | Delta |
|---|---|---|
| conformant: 346 | conformant: 359 | **+13** |
| structural-match: 265 | structural-match: 252 | **−13** |
| diverged: 166 | diverged: 166 | 0 |
| regressions: 0 | regressions: 0 | 0 ✓ |

13 graphs moved structural→byte in pango (17 in headless). Notable: `2193`,
`graphs-b`, `graphs-b94`, `graphs-b117`, `graphs-nhg`, `graphs-states`,
`graphs-url`, `graphs-xlabels`, `linux.i386-ER`, `share-ER`, `share-b94`,
`share-nhg`, `share-states`, `windows-ER`, `windows-b94`, `windows-nhg`,
`windows-states`. Among these: `graphs-url` and `graphs-xlabels` had been
listed as "separate edge-spline @d residuals" in prior missions — the lone-edge
routing order was the actual cause.

### Perf findings

No graph that was ≤2× native crossed to >2× due to T1.2. The 17 improved
graphs render 0.01–0.16× native (far under). Large dot graphs with many
multi-rank lone edges slowed ~2× (2475_2: 2.45→5.1×, share-b29:
2.31→3.06×, b100: 3.84→7.76×) — these were already >2× and the slowdown
is the faithful cost of correct full-corridor routing replacing degenerate
straights. This is the port's pre-existing per-box routespline cost gap
(see `[[mincross-perf-is-perop-not-iteration]]`). Documented in the decision
journal as a follow-up, not a blocker.

### Key decisions (5 logged)

1. T1.1: Focused `n0→n1` path assertion (not whole-SVG golden) — clean
   red→green with ldbxtried's 23 other structural diffs excluded.
2. T0.3: Route lone edges in-place at their `edgecmp` position (Option A) —
   no comparator change, no reach into `recoverSlack`/`routeRegularEdgeFaithful`.
3. T1.2: Pre-loop `EDGETYPE_LINE` label placement (C dotsplines.c:334-340)
   required after lone edges moved to in-loop routing.
4. T1.2: Extract `finalizeSplines` to keep `dotSplines_` CCN ≤10 after
   pre-loop branch added.
5. T2.1: Stop condition (perf) — user chose "Ship it + follow-up"; perf
   slowdown is faithful, not double-routing (backstop probe = 0 edges).

### Known issues / follow-ups

- **Routespline per-box perf gap** (large dot graphs): pre-existing, exposed by
  this fix. File as a dedicated perf mission when routespline becomes the next
  bottleneck. Tracked in decision journal.
- **`graphs-ldbxtried` whole-SVG stays diverged**: expected — it has 23+ other
  structural diffs unrelated to the lone-edge order fix. The `n0→n1` path is
  pinned and correct; the graph-wide verdict is a separate backlog item.

### Gate results

- `npm test` — all tests pass (focused golden `n0→n1` GREEN ✅)
- `npm run survey:gate` — GATE PASS, 0 regressions ✅
- Pango baseline: byte=359/structural=252/diverged=166 ✅
