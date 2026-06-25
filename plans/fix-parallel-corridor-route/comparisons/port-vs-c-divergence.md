<!-- SPDX-License-Identifier: EPL-2.0 -->

# T0.2 — Port-vs-C parallel-route divergence

## Method
- Port dispatch chain (current `main`):
  `dotSplines_` → `collectNodeEdges` → `routeEdgeGroup` → `dispatchEdgeGroup`
  (splines.ts:357) → `routeParallelEdgeGroup` (splines-route.ts:343) →
  `baseSplineForGroup` (splines-route.ts:288) →
  `routeRegularEdgeFaithful(fe) ?? routeMultiRankEdgeFaithful(fe)`.
- Added `DBG_ROUTE`-gated stderr dumps in `routeParallelEdgeGroup` and
  `routeMultiRankEdgeFaithful`; rendered the T0.1 inputs via
  `test/corpus/render-one.ts`; **all `src/` instrumentation reverted**
  (`git diff --stat src/` is empty — verified).
- C ground truth from `comparisons/c-oracle-dump.md` (instrumented oracle).

## Root cause — group base is routed from the virtual chain-head SEGMENT, not the resolved original edge

The group representative `edges[0]` handed to `baseSplineForGroup` is the **first
virtual segment** `tail → firstVnode` (head is a VIRTUAL node at rank `r+1`), NOT
the original multi-rank edge `tail → realHead`. `routeRegularEdgeFaithful` guards
only on `head.rank === r+1` — it does **not** check whether the head is virtual —
so it ACCEPTS the adjacent-looking segment and routes a single straight
`tail → vnode` base (returns non-null). The `?? routeMultiRankEdgeFaithful`
chain-walker is therefore never reached, and the base ends at the first virtual
node instead of the real head.

In C, the single-rank path is taken only for a REAL head; a virtual head continues
through the `while (ND_node_type(hn)==VIRTUAL)` chain walk
(`dotsplines.c:1773`). The lone-edge port path (`edge-route.ts:routeOneEdge`)
already does the right thing because it is invoked with the **original** edge
(real head) per edge, so `routeRegularEdgeFaithful` declines and the multi-rank
fallback walks the chain. The bug is exclusive to the **parallel/opposing group
path** (`uniq.length > 1`), whose representative is the unresolved segment.

## Proof — `routeMultiRankEdgeFaithful` on the RESOLVED original reproduces C

`DBG_ROUTE` probe (resolve `edges[0]` → original, re-route):

```
REPRO a->b:
[PORT-PG] rep=a->(vn) headVirtual=true orig=a->b origRanks=0->3 cnt=3
  regularOnOrig=null(declines) multiRankOnOrig=7pts end=(98.00,19.00)
  basePts=4 baseEnd=(98.00,163.00)

LDBXTRIED n0->n2:
[PORT-PG] rep=n0->(vn) headVirtual=true orig=n0->n2 origRanks=0->4 cnt=3
  regularOnOrig=null(declines) multiRankOnOrig=10pts end=(819.00,204.39)
  basePts=4 baseEnd=(967.00,482.14)
```

- `regularOnOrig=null(declines)` — on the original (multi-rank) edge,
  `routeRegularEdgeFaithful` correctly declines.
- `multiRankOnOrig` — the chain router on the original yields **7pts ending at
  (98,19)=b** (repro) and **10pts ending at (819,204)≈n2** (ldbxtried), matching
  C's 7-pt/10-pt corridor splines (`c-oracle-dump.md`).
- `basePts=4 baseEnd=(vnode)` — the CURRENT base is the wrong 4-pt straight
  segment to the first virtual node.

## Per-edge divergence (interface contract for T0.3)

### `ldbxtried` `n0 -> n2` (×3)
| field | C (oracle) | Port (current) |
|---|---|---|
| `cBoxes` / `portBoxes` | 9-box up-right-down corridor (T0.1) | **n/a — never built**: routed the adjacent `n0→vnode` segment, so only an adjacent single-rank box set was built |
| `cPorts` / `portPorts` | eps `(347,549.74)→(819,196.39)` (tail port → head port) | base eps `…→(967,482)` (tail port → **first vnode**, not the head port) |
| `cPolyline` / `portPolyline` | `(347,549.74)\|(899,416.34)\|(899,356.76)\|(897,261.18)\|(819,196.39)` | straight `…→(967,482)` (1 segment to the vnode) |
| `cPtCount` / `portPtCount` | **10** (3-bezier) | **4** (1-bezier) |
| `firstDivergence` | — | **the edge representative**: port routes `n0→firstVnode` (head virtual) as an adjacent edge; C routes `n0→n2` through the chain. Divergence is upstream of boxes/ports/polyline. |

### minimal repro `a -> b` (×3)
| field | C (oracle) | Port (current) |
|---|---|---|
| `cBoxes` / `portBoxes` | 7-box corridor (T0.1) | n/a — adjacent `a→vnode` only |
| `cPorts` / `portPorts` | `(34,233)→(98,19)` | `…→(98,163)` (first vnode) |
| `cPolyline` / `portPolyline` | `(34,233)\|(61,180)\|(98,19)` | straight `…→(98,163)` |
| `cPtCount` / `portPtCount` | **7** (2-bezier) | **4** (1-bezier) |
| `firstDivergence` | — | edge representative (virtual head accepted as adjacent) |

## Sub-bug classification
The brief's preset enum `{centers-not-offset, boxes-differ, ports-not-offset,
straight-path}` does not fit — those derive from the (now-refined, T0.1) per-edge
offset-port hypothesis. The actual sub-bug is a **5th class**:

> **`representative-not-resolved`** — the parallel/opposing group routes its shared
> base from the unresolved first virtual segment (`edges[0]`, head = vnode) instead
> of `resolveOrigEdge(edges[0])` (the original `tail → realHead`). The
> adjacent-rank faithful router accepts the virtual-headed segment and
> short-circuits the multi-rank chain router.

The *symptom* matches `straight-path` (a 1-bezier under-segmented edge to a wrong
endpoint), but the *mechanism* is the unresolved representative, not
`makeStraightEdges`. `makeStraightEdges` is NOT on this path (the dispatch goes
through `routeParallelEdgeGroup`, not the curved/straight branch).

## Fix locus (for T0.3 GO + Batch-1 split)
- **Contained to `baseSplineForGroup` (`splines-route.ts`).** Resolve the
  representative to its original edge before routing:
  `const o = resolveOrigEdge(e0); const fe = isBackEdgeMember(o) ? makeFwdEdge(o) : o;`
  Then `routeRegularEdgeFaithful(fe)` declines for multi-rank and
  `routeMultiRankEdgeFaithful(fe)` walks the corridor — proven above to match C.
- **NOT** `src/pathplan/` (ADR-5 stop condition does not trigger).
- **NOT** `straight-edges.ts` (T1.3) or `edge-route-boxes.ts`/`edge-route-routing.ts`
  (T1.4) — the box/corridor builders are correct; they are simply never invoked
  for the group base today. → T1.3 and T1.4 are **N/A**.
- Risk remains per ADR-3 (shared router; the change alters every multi-rank
  parallel/opposing group's base) → full 0-regression survey is the gate.

## Reproduce
```
# add DBG_ROUTE dumps in routeParallelEdgeGroup/baseSplineForGroup, then:
DBG_ROUTE=1 npx tsx test/corpus/render-one.ts \
  ~/git/graphviz/graphs/directed/ldbxtried.gv dot >/dev/null 2>&1 | grep n0->n2
# revert src/ after (git checkout src/...).
```
