<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: subgraph used as edge endpoint dropped rank-set attr + AGSEQ

- **Context**: chasing graphs-ports divergence (maxΔ 556, #worst diverged).
- **Finding**: `src/parser/builder.ts:resolveEndpoint` only collected node NAMES
  for a subgraph edge endpoint (`TOP -> {rank=same a b c} -> BOTTOM`). It never
  created/registered the subgraph object, so:
  1. `rank=same` (and rank=min/max/source/sink) was silently dropped →
     `collapse_sets` never unioned the set → intra-set edges (a->b) split the
     nodes across ranks instead of one rank with flat edges.
  2. The endpoint subgraph never consumed its anon-id/AGSEQ → a following
     cluster got `clust1` where C emits `clust2` (oracle-confirmed).
- **Fix**: route endpoint subgraphs through `processSubgraph` (resolve each
  endpoint once to avoid double-creating an interior `A -> {S} -> B`), then
  expand edges over its member nodes. Matches cgraph grammar (endpoint:
  subgraph creates the Agraph_t first). One-file change.
- **Impact**: ports.gv maxΔ 556 → 18.2 (node `b` x-center 78→631 vs C 638).
  Latent AGSEQ undercount fixed for ALL graphs with subgraph-as-edge-endpoint.
- **Residual on ports.gv**: 2 edges into node `d` (HTML-table with nested
  `inner` table + `htmlleft` port) still differ in point count — a SEPARATE
  HTML-table-port routing issue, not the rank=same bug.
- **Confidence**: High — oracle-confirmed rank (m2), AGSEQ (clust2), node b pos.
- **Standalone vs inline**: standalone `subgraph { rank=same; ... }` always
  worked (goes through processSubgraph); only the edge-endpoint form was broken.
