<!-- SPDX-License-Identifier: EPL-2.0 -->

# T0.2 — Port two-pass order vs C + `edgecmp` containment

Temporary `globalThis.DBG_ORDER`-gated stderr dumps were added to
`splines.ts:dotSplines_` (pass-1 `[P1]` line per `edgecmp` group, classified
GROUP/LONE/FLAT/SELF) and `edge-route.ts:routeDotEdges` (pass-2 `[P2]` line per
edge). Rendered `ldbxtried` + `/tmp/repro1.gv`, captured both passes, then
**reverted**. `git diff --stat src/` is empty; `npm run typecheck` exits 0.

## The port's two passes

`dotSplines_` (splines.ts:470):
1. collects `collectNodeEdges` → `edges.sort(edgecmp)` (L478) — the **single
   faithful C sort**.
2. **Pass 1** (L480-482): walks the sorted list; `routeEdgeGroup` →
   `dispatchEdgeGroup`. Routes only `cnt>1` cross-rank groups
   (`routeParallelEdgeGroup`) and self-loops. **Early-returns** flats
   (`rank(tail)==rank(head)`) and lone edges (`dedupByOrig().length <= 1`).
3. **Pass 2** (L488): `routeDotEdges` → `orderedDotEdges` (re-sorts originals by
   `edgeRouteCmp`, same keys as `edgecmp`) routes everything still unrouted
   (every lone + flat edge), **after** all pass-1 groups.

## ldbxtried — side by side

| edge | C seq (pos) | port P1 pos | port classify | routed in |
|----|----|----|----|----|
| `n0->n1` (lone) | 30 (pos 34) | **pos 34** | LONE(p2) | **pass 2** |
| `n0->n2` group (cnt=3) | 52 (pos 67) | **pos 67** | GROUP(p1) | **pass 1** |

Port `[P1]` positions are **positionally identical** to C (`pos 34`, `pos 67`).
Port `[P2]` trace: `n0->n1 spl=false` (routed in pass 2), `n0->n2 spl=true` ×3
(already routed in pass 1, skipped). Total groups: **52** (= C). Classification:
**13 GROUP + 39 LONE** = C's **13 cnt>1 + 39 cnt=1**. Exact match.

## repro1 — side by side (`/tmp/repro1.gv`)

| pos | edge | C | port P1 | classify |
|----|----|----|----|----|
| 0 | `m1->m2` | ✓ | ✓ | LONE(p2) |
| 1 | `a->b` | ✓ | ✓ | LONE(p2) |
| 2 | `b->c` | ✓ | ✓ | LONE(p2) |
| 3 | `m2->c` | ✓ | ✓ | LONE(p2) |
| 4 | `a->c` (cnt=2) | ✓ | ✓ | GROUP(p1) |

Identical order. `a->b` (pos 1) deferred to pass 2; `a->c` group (pos 4) routed
in pass 1 — same two-pass inversion as ldbxtried.

## The divergence

The port's `edgecmp` order is **correct and identical to C**. The bug is **not
ordering** — it is that **pass 1 routes only groups while deferring all lone
edges to pass 2**, which runs after every group's `recover_slack` /
`top_bound`/`bot_bound` state mutation. So a lone edge that C routes *before* a
group (because the lone edge has smaller `|rank diff|`) is, in the port, routed
*after* that group — reading the group-moved shared vnode.

For `ldbxtried n0->n1`: C routes it at seq 30 reading rank-1 `%0` at x=967 →
**7-pt corridor**; the port routes it in pass 2 after the `n0->n2` group moved
`%0` to 789 → **4-pt straight** (confirmed: port `n0->n1`=4pt vs C=7pt;
`n0->n2`=10pt both).

## Containment (ADR-5 gate)

- **`edgecmp` reproduces C's order: YES** — empirically positional-exact on
  ldbxtried (52 groups, pos 34 / pos 67) and repro1.
- **Unify achievable with NO comparator change: YES.** Folding pass-2 lone
  dispatch into the pass-1 `edgecmp` loop needs no change to `edgecmp` or
  `edgeRouteCmp` — the loop already walks the correct order; only the
  *dispatch-vs-defer* decision changes. **T1.3 (`edge-order.ts` alignment) is
  N/A.**
- **Fix locus:** `splines.ts` pass-1 loop (route lone/flat groups in-place
  instead of early-returning) + `edge-route.ts` (reuse the existing
  `routeOneEdge`; the pass-2 `routeDotEdges` becomes redundant and is dropped).
  **No reach into `routeRegularEdgeFaithful` / `recoverSlack` / comparator
  semantics.** → contained to the two dispatch files → GO-eligible.

## Interface contract (for T0.3)

```json
{
  "cOrder": ["...52 groups; n0->n1 @ seq30/pos34, n0->n2 grp @ seq52/pos67..."],
  "portPass1": ["same 52-group edgecmp order; n0->n1 @ pos34 (LONE,deferred), n0->n2 grp @ pos67 (GROUP,routed)"],
  "portPass2": ["routeDotEdges: all 39 lone + flat edges, AFTER pass-1 groups; n0->n1 routed here"],
  "edgecmpOrder": "splines.ts edgecmp == C dispatch order (positional-exact)",
  "edgecmpReproducesC": true,
  "divergentLoneEdges": ["ldbxtried n0->n1 (C@30 before n0->n2 grp@52; port routes it in pass2 after the group moved shared rank-1 %0)"],
  "unifyNeedsComparatorChange": false,
  "fixContainedTo": ["src/layout/dot/splines.ts (pass-1 loop)", "src/layout/dot/edge-route.ts (reuse routeOneEdge; drop routeDotEdges 2nd pass)"]
}
```

## Acceptance — met

- ✅ Localizes the divergent lone edge: `n0->n1`, C-routed before the `n0->n2`
  group that the port routes after.
- ✅ States `edgecmp` reproduces C's order (GO gate) and T1.3 not needed.
- ✅ `git diff --stat src/` empty after revert.
