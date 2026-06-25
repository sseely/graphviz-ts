<!-- SPDX-License-Identifier: EPL-2.0 -->

# T0.3 — Root cause + GO/STOP

## Decision: **GO**
The fix is contained to `baseSplineForGroup` in `src/layout/dot/splines-route.ts`
(one resolution change). No `src/pathplan/` change (ADR-5 STOP does not trigger).
Box/corridor builders and `straight-edges.ts` are correct and unaffected → T1.3
and T1.4 are **N/A**.

## Mechanism (one line)
The parallel/opposing edge group routes its shared base from the **unresolved
first virtual segment** `edges[0]` (head = a VIRTUAL chain node at rank `r+1`)
instead of `resolveOrigEdge(edges[0])` (the original `tail → realHead`);
`routeRegularEdgeFaithful` accepts the virtual-headed segment as an adjacent edge
and routes a 1-bezier straight base to the first vnode, short-circuiting the
multi-rank chain router that would walk the full corridor.

## Evidence (cites the dumps)
- **C** (`c-oracle-dump.md`): C routes each cnt-group **once** through the
  rank-box corridor from the un-offset node ports, then x-shifts only **interior**
  points for copies (endpoints fixed). `ldbxtried n0->n2`: 9-box corridor,
  polyline `(347,549.74)|(899,416.34)|(899,356.76)|(897,261.18)|(819,196.39)`,
  **10-pt** spline reaching n2. `repro a->b`: 7-box, **7-pt** spline reaching b.
  Endpoints are NOT pre-offset (refutes the old per-edge offset-port hypothesis).
- **Port** (`port-vs-c-divergence.md`): the group representative is `n0->(vn)` /
  `a->(vn)` (`headVirtual=true`). Current base = **4-pt** straight line ending at
  the first vnode `(967,482)` / `(98,163)` — not the head. SVG head arrowheads land
  in empty space (985,-483) / (87,-167).
- **Probe (proves the fix)**: `routeMultiRankEdgeFaithful` on
  `resolveOrigEdge(edges[0])` returns **10pts end (819,204)≈n2** (ldbxtried) and
  **7pts end (98,19)=b** (repro), matching C. `routeRegularEdgeFaithful` on the
  resolved original correctly **declines**.

## Affected sub-cases
1. **Parallel cross-rank groups** from any node (in or out of a cluster) to a node
   ≥2 ranks away — e.g. `ldbxtried n0->n2` ×3, `n448->n2`, `n464->n2`, the repro.
2. **Opposing 2-cycle cross-rank groups** (same dispatch via `dispatchEdgeGroup`
   `uniq.length>1`); the representative is likewise the virtual segment.
3. **NOT** lone edges — `edge-route.ts:routeOneEdge` is invoked with the original
   (real-head) edge, so it already declines→chains correctly. **NOT** adjacent
   parallel groups whose representative head is the real node (e.g. `n488->n2`,
   which already routes to n2).

## Exact functions / files to change
| File | Function | Change |
|---|---|---|
| `src/layout/dot/splines-route.ts` | `baseSplineForGroup` | Resolve `e0 → resolveOrigEdge(e0)` before computing `fe`, so the multi-rank chain router receives the original `tail → realHead` edge. `resolveOrigEdge` is already imported. |

Reference fix shape (final form decided in T1.2):
```ts
function baseSplineForGroup(g: Graph, e0: Edge): Point[] | null {
  const o = resolveOrigEdge(e0);
  const fe = isBackEdgeMember(o) ? makeFwdEdge(o) : o;
  return routeRegularEdgeFaithful(g, fe) ?? routeMultiRankEdgeFaithful(g, fe);
}
```
Mirrors C `make_regular_edge`, which resolves the real edge
(`for (realedge=...; ED_to_orig...)` / `getmainedge` + the
`while (ND_node_type(hn)==VIRTUAL)` chain walk) before/while routing.

## pathplan check (ADR-5)
The corridor/box/`routesplines` machinery (`edge-route-boxes.ts`,
`edge-route-routing.ts`, `edge-route-chain.ts`, `splines-clip.ts`,
`src/pathplan/`) is already correct — the probe shows it produces C-matching
geometry once given the right edge. **No pathplan change.** → **GO.**

## Refined Batch-1 split
| Task | Status | Write-set |
|---|---|---|
| T1.1 goldens (red) | **needed** | `test/golden/inputs/*`, `test/golden/refs/*`, `test/golden/manifest.json`, `test/golden/suite.test.ts` (count) |
| T1.2 offset-port route → resolve representative | **needed (the fix)** | `src/layout/dot/splines-route.ts` (only). `edge-route-faithful.ts` likely **not** needed — `routeRegularEdgeFaithful` already declines correctly on the resolved original; touch it only if a guard refinement proves necessary. |
| T1.3 straight-edges | **N/A** | — (mechanism is not `makeStraightEdges`) |
| T1.4 boxes/corridor | **N/A** | — (corridor builders verified correct by the probe) |

## Residual risk (carried into Batch 1)
ADR-3 shared-router risk stands: this changes the base for **every** multi-rank
parallel/opposing group. Some graphs may currently byte-match *because* the buggy
short base happens to coincide with C (stacked endpoints / no obstacle). The
0-regression survey gate (per-id verdicts vs a fresh oracle) is the safety net;
commit incrementally for bisectability.
