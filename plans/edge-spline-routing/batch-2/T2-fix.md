<!-- SPDX-License-Identifier: EPL-2.0 -->

# T2 — Fix the localized divergence: edge routing ORDER

> Rewritten by S1 from the instrumented C-vs-port diff. See
> [decisions.md#d-fixsite](../decisions.md#d-fixsite) for the full localization.

## Context

Faithful port; `~/git/graphviz` is the spec. Long edges emit the wrong cubic
count vs the oracle. S1 pinned the cause to **edge routing ORDER**: the port's
`routeDotEdges` (`src/layout/dot/edge-route.ts`) routes edges in
`g.nodes.values()` (insertion) order, whereas C's `dot_splines_`
(`lib/dotgen/dotsplines.c:228`) routes a list built **rank-major**
(`GD_rank[i].v[j]` out-edges) then **`edgecmp`-sorted** (`dotsplines.c:535`).
Because `recover_slack` mutates **shared** virtual nodes that other edges read as
`maximal_bbox` neighbours, corridor geometry is order-dependent: in C the shorter
`n12->n14` (span 2) routes before the longer edge that displaces its neighbour;
in the port the order is flipped, so `n12->n14` sees a +12.7-displaced neighbour,
its corridor waist vanishes, and `Pshortestpath` returns a straight 2-pt polyline
(1 cubic) where C returns a bent 3-pt polyline (2 cubics).

## Task

1. **Port `edgecmp`** (`dotsplines.c:535-634`) as a comparator over the port's
   `Edge`. Key order, returning negative = a-first:
   - edge type (`ED_tree_index & EDGETYPEMASK`): **descending** (C: `et0<et1 ⇒ 1`).
   - rank-span `|tail.rank − head.rank|` of the **main edge** (`getmainedge`):
     ascending.
   - `|tail.coord.x − head.coord.x|` of the main edge: ascending.
   - `AGSEQ(mainEdge)`: ascending.
   - (ports / GRAPHTYPEMASK / flat-label / `AGSEQ(e)`: port the cheap tails for
     fidelity; ties keep rank-major order under JS stable sort, and C batches
     edgecmp-equal edges via the cnt-loop so their relative order is immaterial —
     do **not** over-engineer the port-pointer comparison if the port lacks the
     exact field.)
   - `getmainedge`: walk `to_virt` then `to_orig` to the NORMAL edge.
2. **Reorder `routeDotEdges`:** build the edge list rank-major over
   `g.info.rank[i].v[j]` (collect `buildOutEdgeIndex.get(node)` for each; virtual
   nodes return nothing — only real tails carry out-edges, matching C's
   NORMAL/splineMerge-node collection), `Array.sort` it by the ported `edgecmp`
   (stable), then route in that order with the **unchanged** per-edge guards
   (`spl`/self-loop/`hasValidCoords`) and `routeOneEdge` dispatch. When
   `g.info.rank` is undefined (no ranking — e.g. a degenerate graph), fall back
   to the current `g.nodes.values()` order.
3. Keep `routeOneEdge` and all routing internals untouched — only the iteration
   order changes.

## Write-set

- `src/layout/dot/edge-route.ts` — `routeDotEdges` reorder + edgecmp helper
  (or a new small `src/layout/dot/edge-order.ts` if `edge-route.ts` would exceed
  the 500-line / CCN-10 hook caps; prefer a new module to avoid bloating
  `routeDotEdges`).
- `src/layout/dot/edge-order.test.ts` (or `edge-route` test) — TDD: a unit test
  pinning `edgecmp` ordering on a small synthetic edge set (type, span, |Δx|,
  AGSEQ tie-breaks) + a render test on a long-edge graph asserting the
  `n12->n14`-class spline matches the oracle's piece count.
- `test/golden/inputs/dot-long-edge-order.dot` + `refs/…svg` + `manifest.json` —
  a golden capturing a 2-rank forward edge whose corridor waist depends on
  routing order (the reproducer is a good basis), now byte-matching.

## Read-set

- [decisions.md#d-fixsite](../decisions.md#d-fixsite) (full S1 localization)
- `src/layout/dot/edge-route.ts:377` (`routeDotEdges`) + `buildOutEdgeIndex`
- `~/git/graphviz/lib/dotgen/dotsplines.c:228` (`dot_splines_` edges-list build,
  lines 280-328) and `:535` (`edgecmp`)
- `src/model/edge.ts`, `src/model/rankEntry.ts` for `seq`/`rank`/`to_orig`/`to_virt`

## Architecture decisions

D2 (pin to C), D3 (long-edge class only), D4 (**0 regressions** — the global
reorder must not regress any of the 280 byte-match rows; T3 is the gate).

## Interface contracts

None downstream beyond T3's verification.

## Acceptance criteria

- Given the reproducer `/tmp/le_long.gv`, when rendered, then **every** edge path
  byte-matches the oracle (`n12->n14` = 2 cubics; the other 25 unchanged).
- Given the `edgecmp` unit test, then ordering matches C for type/span/|Δx|/AGSEQ.
- Given the full corpus survey (T3), then `byte-match ≥ 280` and **0 per-id
  regressions**. If any row regresses, STOP (D4) — the reorder is not free; report
  to the user with the regressed ids before forcing it.
- Given the new golden, when the golden suite runs, then it passes.

## Observability

N/A — render-path geometry.

## Rollback

**Reversible** — revert the commit; iteration-order-only change.

## Quality bar

`tsc` clean; `vitest` green incl. the new test/golden. Commit:
`fix(T2): route edges in dot_splines_ order (rank-major + edgecmp)`. Body: cite
`dot_splines_`/`edgecmp` and the recover_slack-shared-neighbour mechanism.

## Boundaries

- **Always:** pin the order to C (`dot_splines_` + `edgecmp`); keep `routeOneEdge`
  and corridor/recover_slack code byte-identical.
- **Never:** reimplement the fitter or the corridor math (both faithful);
  hand-gate a per-edge corridor hack instead of fixing the order; force the
  reorder if T3 shows ≥1 regression (stop + report per D4).
