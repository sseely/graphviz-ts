# Batch 1 findings — B1 cluster-name collision (FIXED)

**Result:** graphs-fdp and graphs-b145 fixed by porting fdp's compound
cluster-edge preprocessing. Both now clear to **inj=0** under injection
(drift-exonerated / A1). The predicted "frame/postprocess/edge-label" B1 was
EMPTY (T0.3); the real B1 was a structural porting gap.

## T1.1 — Mechanism (diagnosis.md artifact)

**Mechanism.** In fdp, an edge whose endpoint *names a cluster* (e.g.
`e -- clusterB` where `subgraph clusterB {…}` exists) is NOT drawn as a node.
C's `processClusterEdges` (run from `fdp_init_node_edge`, fdpinit.c:90) replaces
the cluster-named endpoint with an *invisible* box "cluster node" sized to the
cluster (setClustNodes), clones the edge onto it, and **deletes** the original
visible node. dot/neato keep drawing such a node — this substitution is
**fdp-only**.

**Origin.** The port never ported `processClusterEdges`
(`src/layout/fdp/init.ts` explicitly documented the gap on a *false* assumption:
"no supported input has edges whose endpoint is a cluster"). So the port drew
`node:clusterB`/`node:clusterC` (graphs-fdp) and `node:cluster_foo`
(graphs-b145) as visible labeled ellipses.

**Causal chain.** T0.3 residual signature was `node/_draw_/structural +
node/_ldraw_/structural` on `node:clusterB` etc. — a *structural presence* diff
(port emits the node, oracle does not). Injection cannot add/remove emitted
elements, so it survived injection ⇒ genuine emission bug, not FP drift. The
downstream numeric residual (graph bb Δ=const, edge beziers) was the phantom
node inflating the bb and edges re-routing around it.

**Ruled out.** (a) Frame/postprocess offset — the residual was structural, not
a uniform dx=0/const-dy translation. (b) Edge-label (`lp`) side flip — no edge
labels involved. (c) dot/neato general cluster behavior — verified dot AND neato
both *draw* clusterB/clusterC (only fdp suppresses), so the mechanism is in
`processClusterEdges`, called only from `lib/fdpgen/fdpinit.c:90`.

## T1.2 — Fix

Ported the fdp compound cluster-edge feature faithfully (@see
lib/common/utils.c:processClusterEdges + lib/fdpgen/layout.c:setClustNodes):

1. **`src/layout/fdp/cluster-edges.ts`** (new) — `processClusterEdges` +
   `checkCompound` + `clustNode` + `cloneEdge`/`insertEdge`/`mapEdge`/`mapc` +
   `mkClustMap`/`fillMap`. Detects edges whose endpoint name starts with
   "cluster" and matches a real cluster; creates an invisible `__0:<cluster>`
   proxy (`ND_clustnode`, style=invis), clones the edge, deletes the original.
2. **`src/layout/fdp/init.ts`** — call `processClusterEdges` first in
   `fdpInitNodeEdge` (C site: before node sizing/ids).
3. **`src/layout/fdp/layout.ts`** — implemented the real `setClustNodes`:
   position each proxy at its cluster center, size to the cluster bb (so the
   incident edge clips to the cluster boundary), set lw/rw/ht + box vertices.
4. **`src/render/dot.ts`** — the dot serializer suppresses `ND_clustnode` node
   declarations and writes a proxy's name as the cluster name (strip the
   `__i:` prefix) — mirrors output.c:114/146.
5. **`src/layout/dot/rank.ts`** — ROOT-fix of a latent bug: `nodeInduce` was
   setting `n.info.clustnode = true` on real dot cluster-member nodes, which C's
   `node_induce` never does (it sets `ND_clust` only). Benign until (4) made the
   serializer key on `clustnode`; removing it keeps `clustnode` fdp-exclusive.

C fidelity note: C's `clustNode` `*idx++` post-increments the *pointer*, not the
counter, so index_counter never advances — every proxy for a cluster is
`__0:<cluster>` and `agnode` dedups to one shared proxy. Replicated.

## Verification

- graphs-fdp: base 131 → **inj 0** (was base 162 → inj 45 w/ 10 structural).
- graphs-b145: base 79 → **inj 0** (was base 96 → inj 27 w/ structural).
- Full fresh fdp engine-walk (762 items): **0 pass→diverged regressions**.
  (`2620 diverged→oracle-error` is a sweep-time oracle TIMEOUT under CPU load —
  the C oracle succeeds standalone (exit 0) and the port renders 2620's 22
  cluster refs cleanly; not a port regression.)
- `tsc` clean; `npm test` 3220 passed (incl. 42 dot cluster goldens that
  transiently broke on the shared serializer change, then passed after the
  rank.ts root-fix).
- Shared `render/dot.ts` is provably inert for non-fdp engines: post-fix,
  `clustnode` is set only by fdp's `processClusterEdges`, so `writeNodeTest`/
  `emitNodeName` are no-ops elsewhere (corroborated by cross-engine goldens).

## Bucket status after Batch 1

B1 CLEARED — graphs-fdp, graphs-b145 → drift-exonerated (A1). Remaining
not-cleared = **2** (241_0, 2095), both Batch 3 (B3 A9).
