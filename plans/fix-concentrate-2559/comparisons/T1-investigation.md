# T1 — Concentrate-2559 merged-trunk routing divergence

## ⛔ STOP CONDITION TRIGGERED

**The fix locus is OUTSIDE the declared write-set**
(`edge-route-chain.ts` / `splines-route.ts` / `edge-route-faithful.ts`).
The primary fix is in **`src/layout/dot/splines.ts`** (`dotSplines_` gather loop
+ per-segment trunk dispatch). Per the mission README stop condition #1, execution
halts here for a human write-set decision before T2.

`conc.ts` / `classify.ts` are confirmed **out of scope** — the merge is correct.

---

## Structural divergence (confirmed)

`digraph { concentrate=true; a->b [label="1"]; c->b; d->b }`

Per-edge `<path>` counts (local dot 15.0.0 vs port):

| edge | native | port |
|------|--------|------|
| edge1 `a->b` | 1 | 1 |
| edge2 `c->b` | **2** | **1** |
| edge3 `d->b` | 1 | 1 |

Native `c->b` is a 2-piece spline split at the merge node (~`135,-62`):
```
<path d="M119.03,-94.24C...135,-63.25"/>   <!-- lead-in  c -> vMERGE -->
<path d="M135,-61.25C...98.06,-30.55"/>     <!-- trunk    vMERGE -> b (carries arrowhead) -->
```
`d->b` draws only its lead-in `d -> vMERGE` (1 path); the shared trunk
`vMERGE -> b` is attributed to the representative edge `c->b`.

## C mechanism (`lib/dotgen/dotsplines.c`)

1. **`spline_merge(n)`** (`:108`) — true for a VIRTUAL node with
   `in.size>1 || out.size>1`. The shared node `vMERGE` (in=2 from c,d; out=1 to b)
   qualifies.
2. **Edge gather** (`:290-298`) — iterates `GD_rank(g)[i].v[j]` (ALL nodes incl.
   virtual). For each node that is `NORMAL` **or** `spline_merge`, it appends every
   `ND_out` edge:
   ```c
   if (ND_node_type(n) != NORMAL && !sinfo.splineMerge(n)) continue;
   for (k=0; (e = ND_out(n).list[k]); k++) { ...; LIST_APPEND(&edges, e); }
   ```
   So the trunk `vMERGE->b` (out-edge of the merge node) **is gathered as its own
   edge to route**.
3. **Group loop** (`:343-419`) — `portcmp` breaks `c->vMERGE` and `vMERGE->b` into
   separate cnt=1 groups (different tail ports / heads), each routed by
   `make_regular_edge`. Each is a single rank-step (`abs(rankdiff)==1`, no
   `hackflag`).
4. **`clip_and_install`** (`splines.c`; port `newSpline`) **APPENDS** a bezier to
   the representative's spline (`getmainedge` → `c->b`). Two routes → `spl->size==2`.
5. **Emit** (`emit.c:1997` `for i < ED_spl(e)->size`) — one `<path>` per bezier →
   `c->b` renders 2 paths.

So a concentrate-merged chain is routed **per rank-step segment** and the
representative **accumulates one bezier per segment**.

## Port divergence (instrumented, probes reverted)

The port routes **per original edge's full chain**, not per segment:

- `dotSplines_` (`splines.ts:521`) gathers via
  `for (const n of g.nodes.values()) collectNodeEdges(n, edges)`.
  **`g.nodes.values()` contains only REAL nodes** — probe output:
  ```
  [NODES] g.nodes: real=4 virt=0 merge=0 | nlist: real=4 virt=2 merge=1
  ```
  The merge node lives in `g.info.nlist` (C `GD_nlist`) but **not** in `g.nodes`,
  so `collectNodeEdges(mergeNode)` is never called and the trunk `vMERGE->b` is
  **never gathered**. (This is the documented "Map vs nlist iteration hazard".)
  `collectOutEdges`/`nodeNeedsRouting` already handle merge nodes correctly — the
  intent is defeated solely by the iteration source.
- Group-dispatch probe confirms only 3 groups reach `dispatchEdgeGroup`
  (no trunk group):
  ```
  [GRP] group=[a->v{orig=a->b}] -> uniq=[a->v]
  [GRP] group=[c->v{orig=c->b}] -> uniq=[c->v]
  [GRP] group=[d->v{orig=d->b}] -> uniq=[d->v]
  ```
- `c->b` is then routed by `routeMultiRankEdgeFaithful` (`edge-route-chain.ts`),
  whose `chainSegments` walks the **whole** chain
  `[c->vMERGE(merge=true), vMERGE->b]` and `routeChainSegmented` emits a **single**
  bezier ending at `b` (the while-loop guard `isChainVirtual` stops at the merge
  node, then `finishChain` routes one piece to the real head). One `clipAndInstall`
  → one bezier → one `<path>`.

The port's spline model already supports multiple beziers: `newSpline`
(`common/splines-clip.ts:396`) **pushes** a bezier and increments `spl.size`, and
the SVG emit iterates `spl.size`. The accumulation machinery exists; the trunk
segment simply never gets routed+installed.

## Why this is a multi-file fix (the write-set problem)

A faithful fix must make the representative accumulate the trunk bezier:

1. **`splines.ts` — `dotSplines_` gather (line 521):** iterate `g.info.nlist`
   (all nodes incl. virtual/merge), not `g.nodes.values()`, so merge-node
   out-edges are gathered. *(Outside write-set.)*
2. **`splines.ts` — dispatch:** the trunk group `vMERGE->b` must route and
   **append** its bezier to the already-routed representative `c->b` (current
   `routeLoneEdge` bails when `e.info.spl !== undefined`, and `dispatchEdgeGroup`
   resolves to the original edge — both would drop the trunk). Per-segment routing
   that mirrors C's `clip_and_install` accumulation is required here. *(Outside
   write-set.)*
3. **`edge-route-chain.ts` — `routeMultiRankEdgeFaithful`/`routeChainSegmented`:**
   the lead-in `c->vMERGE` must route **only up to the merge node** (one rank
   step), not the full chain to `b`, so the trunk is the separately-routed
   `vMERGE->b` piece. *(Inside write-set.)*

Items 1–2 are the load-bearing change and live in `splines.ts`. An in-write-set-only
fix is not achievable without overloading `routeMultiRankEdgeFaithful`'s
return-contract (return `null`="declined" repurposed to "already installed"),
which also has a second caller (`splines-route.ts:302 baseSplineForGroup`) and
violates ADR-1 (faithful port, no special-case hacks).

## Recommendation for the human

Expand the T2 write-set to include `src/layout/dot/splines.ts`. The faithful change
mirrors C's per-segment routing: gather over `nlist` (incl. merge nodes), and route
each merge-bounded segment so the representative edge accumulates one bezier per
segment via `clipAndInstall` — exactly as `make_regular_edge` + `clip_and_install`
do. `conc.ts`/`classify.ts` stay untouched.

```
fixFile: src/layout/dot/splines.ts          # PRIMARY — outside original write-set
fixSymbol: dotSplines_ (gather loop, line 521) + dispatchEdgeGroup/routeLoneEdge trunk accumulation
divergenceLine: src/layout/dot/splines.ts:521 (g.nodes.values() omits the merge node; nlist has it)
secondaryFile: src/layout/dot/edge-route-chain.ts (routeChainSegmented lead-in must stop at the merge node)
trunkAssertion: g#edge2 (c->b) contains exactly 2 <path> elements; g#edge3 (d->b) contains exactly 1
oracleCmd: GVBINDIR=/tmp/ghl dot -Tsvg test/golden/inputs/concentrate-2559.dot   # ADR-2 headless 15.1.0 (npm run survey:setup builds /tmp/ghl). Local-structure equiv: dot -Tsvg ~/git/graphviz/tests/2559.dot
conc_classify_in_scope: false
writeSetAssumptionBroken: true
```
