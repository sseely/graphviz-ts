<!-- SPDX-License-Identifier: EPL-2.0 -->

# T0.3 — Root cause + GO/STOP gate

**Decision: GO.** The fix is C-faithful and contained to the two dispatch files.
Evidence: `c-order-oracle.md` (T0.1, instrumented C), `port-vs-c-order.md` (T0.2,
instrumented port, reverted).

## Mechanism (precise)

C's `dot_splines_` routes **every** edge — lone and group — in **one
`edgecmp`-ordered loop** (dotsplines.c:343-420). `edgecmp` sorts by
`|rank diff|` ascending (key #2), so a lone **adjacent** edge (`|diff|=1`) is
dispatched **before** a multi-rank group (`|diff|≥2`). C therefore routes the
lone edge while the group's chain vnodes are still at their position-assigned
coordinates, *then* routes the group, whose `recover_slack` re-centres those
shared vnodes.

The port splits this into **two passes**:
1. `dotSplines_` pass 1 walks the (correctly `edgecmp`-sorted) list but
   `dispatchEdgeGroup` routes only `cnt>1` cross-rank groups + self-loops and
   **early-returns every lone and flat edge**.
2. `routeDotEdges` pass 2 routes all those deferred edges **after** pass 1 — i.e.
   after every group's `recover_slack` already moved the shared vnodes.

So a lone edge C routes *before* a group is, in the port, routed *after* it.

### Order-sensitive shared state involved
- **`recover_slack` vnode moves** — the confirmed trigger. Pass-1 group routing
  re-centres a shared rank-1 chain vnode; the deferred lone edge then reads the
  moved coordinate as a `maximal_bbox` neighbour.
- **`top_bound`/`bot_bound` installed-spline visibility** — same exposure class:
  a deferred lone edge sees neighbours' pass-1 splines that C had not yet
  installed when it routed the lone edge. (Not separately triggered by
  ldbxtried, but the same two-pass inversion governs it — folding fixes both.)

### Witness (ldbxtried `n0->n1`)
| | C (1 pass) | port (2 pass) |
|----|----|----|
| dispatch of `n0->n1` | seq 30 (pos 34) | pass 2 (after groups) |
| rank-1 `%0` x when `n0->n1` routes | 967 (unmoved) | 789 (group-moved) |
| `n0->n1` spline | **7-pt corridor** | **4-pt straight** |
| `n0->n2` group | 10-pt ×3 | 10-pt ×3 (match) |

## Containment confirmation (ADR-5)

- **Port `edgecmp` reproduces C's order: YES** — positional-exact on ldbxtried
  (52 groups; `n0->n1`@pos34, `n0->n2`grp@pos67; 13 GROUP + 39 LONE = C's 13
  cnt>1 + 39 cnt=1) and repro1. → comparator is already faithful.
- **Exact dispatch change (Option A):** in the `dotSplines_` pass-1 loop, route
  each `edgecmp` group **in place**: `cnt>1` cross-rank → `routeParallelEdgeGroup`
  (unchanged); self-loop → `routeSelfEdgeGroup` (unchanged); otherwise (lone
  cross-rank **and** flat) → the existing lone dispatch `routeOneEdge` per
  original edge in the group. Then **delete the separate `routeDotEdges` pass**.
- **No reach beyond the two dispatch files.** No change to
  `routeRegularEdgeFaithful`, `recoverSlack`, or comparator *semantics*. →
  **contained to `src/layout/dot/splines.ts` + `src/layout/dot/edge-route.ts`.**
- **T1.3 (`edge-order.ts`): N/A** — no comparator change needed.

## Why 0-regression is plausible (not guaranteed — survey is the gate)

Lone-vs-lone relative order is **preserved**: lone edges are single-segment
originals, so their `edgecmp` order (pass-1 keys) equals their current
`edgeRouteCmp` order (pass-2 keys) — same `|rank diff|`, `|x diff|`, `seq`. Only
the **lone-vs-group** interleaving changes, and only graphs where a lone edge
shares a `recover_slack`'d vnode or a `top_bound`/`bot_bound` spline with a group
on the other side of it in `edgecmp` order will move. For the 395 conformant with
graphs with no such interaction, output is unchanged. HIGH blast radius
(shared router) → the **0-regression headless survey + golden pins are the safety
net** (ADR-2).

## Batch-1 implementation guidance (refined)

- **T1.1 (sonnet, test artifacts):** flip the `ldbxtried` golden to active with
  the **C 7-pt `n0->n1`** as the headless reference (its true post-fix verdict —
  byte / structural / knownResidual per the actual result; the `n0->n2` ~1px
  Proutespline residual may keep the whole-SVG golden at structural/knownResidual
  per ADR-4). Add `repro1` (`digraph { a->b; a->c; a->c; m1->m2; m2->c; b->c; }`)
  as a minimal fixture — note it is an **order-signature** pin (port==C even
  pre-fix; it guards the unify against breaking simple lone-before-group cases),
  not a red→green divergence. Keep `parallel-multirank-min`. Bump the
  `suite.test.ts` count.
- **T1.2 (sonnet, `splines.ts`+`edge-route.ts`):** implement Option A above.
  Preserve the pass-2 per-edge guards when folding (`IGNORED`/`FLATORDER` skip,
  `tail===head` skip, `hasValidCoords` skip, `spl !== undefined` skip) inside the
  in-loop lone dispatch. Drop `routeDotEdges`/`orderedDotEdges` (now dead) — grep
  for external callers first; remove only if none. Re-run the full survey after
  the change; **0 regressions** is the gate.
- **T1.3:** mark `[x] N/A`.

## Stop conditions — none triggered
None of the ADR-5 stop conditions fired: the comparator is faithful, the fix
does not reach `routeRegularEdgeFaithful`/`recoverSlack`, and no file outside the
declared write-set needs changing.
