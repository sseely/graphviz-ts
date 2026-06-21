# Triage: attr-or-tag, part 1 of 2

All 17 cases use engine `dot`.

## Per-case findings

| id | engine | firstDiffPath | port value | oracle value | root cause | verdict | fixModule | fixPlan |
|----|--------|---------------|------------|--------------|------------|---------|-----------|---------|
| 1408 | dot | `svg/g[1]/g[5]/polygon[1]` | `<polygon fill="red" stroke="red" points="94.04,-37.5 104.04,-34 94.04,-30.5 94.04,-37.5"/>` | `<ellipse fill="red" stroke="red" cx="101.06" cy="-34" rx="4" ry="4"/>` | `arrowhead=dot` emits polygon (3-pt triangle) instead of filled circle (ellipse); C's `arrow_type_dot` always draws a circle | **deep** | `src/layout/dot/edge-route-arrow.ts` + `src/render/svg-helpers.ts` | Port `arrow_type_dot` from `lib/common/arrows.c:987`; store circle center+radius on `einfo._arrowCircle` alongside the existing `_arrowPts`; emit `<ellipse>` instead of `<polygon>` when that field is set |
| 1447_1 | dot | `svg/g[1]/g[5]/polygon[1]` | `<polygon fill="black" stroke="black" points="106.78,-1257.05 103.28,-1247.05 99.78,-1257.05 106.78,-1257.05"/>` | `<ellipse fill="black" stroke="black" cx="3553.09" cy="-1859.73" rx="4" ry="4"/>` | Same as 1408: `arrowhead=dot` uses polygon, oracle uses ellipse; also layout coordinates differ (large graph) | **deep** | `src/layout/dot/edge-route-arrow.ts` + `src/render/svg-helpers.ts` | Same fix as 1408 (dot arrowhead → ellipse emission) |
| 1453 | dot | `svg/g[1]/g[1]/@id` | `clust1` | `clust4` | Port uses a per-type counter starting at 1; C assigns `clust<AGSEQ>` where AGSEQ is a global sequence shared by all object types. In 1453.dot, two anonymous rank-group subgraphs consume AGSEQ 2 and 3 before the first named cluster, so the first cluster gets AGSEQ 4 | **deep** | `src/render/svg-cluster.ts` + `src/gvc/device.ts` | Port global AGSEQ tracking into the Graph/Node/Edge model (mirroring C's `AGSEQ` macro); use it in `svgBeginCluster` instead of `job.clusterId` |
| 1622_0 | dot | `svg/g[1]/g[1]/text[1]` | `x="19.75" y="-91.25"` | `x="18" y="-109.5"` | Text position differs due to HTML table cell layout coordinates; port computes different `WIDTH`/`HEIGHT` for the nested `<TABLE>` cells in the plaintext node | **deep** | `src/common/htmltable-layout.ts` (or equivalent HTML-table sizing) | Investigate HTML table cell dimension calculation for fixed-size nested tables; this is an HTML label layout gap |
| 1880 | dot | `svg/g[1]/polygon[1]` | `<polygon fill="white" stroke="none" points="-4,4 -4,-949 1123.2,-949 1123.2,4 -4,4"/>` | `<g id="a_graph0"><a …><polygon … points="-4,4 -4,-946 1041.2,-946 1041.2,4 -4,4"/></a></g>` | Oracle wraps graph contents in a tooltip anchor `<g id="a_graph0"><a xlink:title=" ">…</a></g>` because the graph has `tooltip=" "`; port does not emit anchor wrappers for graph-level tooltip. Background polygon coordinates also differ (layout size differs). | **deep** | `src/gvc/device.ts` + `src/render/svg-graph.ts` | Port tooltip-anchor wrapping for graph, cluster, node, and edge objects from `lib/common/emit.c:emit_begin_graph` / `svg_begin_anchor`; separate from id-numbering fix |
| 2183 | dot | `svg/g[1]/g[1]/@class` | `class="cluster"` | `class="cluster swimlane"` | Two issues: (1) port omits `<?xml-stylesheet href="bpmn.css" …?>` PI when graph has `stylesheet=` attr; (2) C's `svg_print_id_class` appends the DOT `class` attr value to the SVG `class` string — port emits the base kind only | **simple** | `src/render/svg-graph.ts` (PI) + `src/render/svg-cluster.ts` + `src/render/svg-helpers.ts` | (a) In `svgBeginGraph` / `svgBeginJob`, read `g.attrs.get('stylesheet')` and emit `<?xml-stylesheet href="…" type="text/css"?>` PI before DOCTYPE; (b) in `svg_print_id_class` equivalent (`svgBeginCluster`, `svgBeginNode`, `svgBeginEdge`, `svgBeginPage`), append ` ` + escaped DOT `class` attr value when present |
| 2184 | dot | `svg/g[1]/@id` | `graph0` | `boss` | Port hardcodes `graph0` for root graph SVG group id; C's `getObjId` reads the DOT `id=` graph attribute first and uses it if set (`graph [id=boss]` in 2184.dot) | **simple** | `src/render/svg-graph.ts` + `src/gvc/device.ts` | In `graphGroupId` / `svgBeginPage`, check `g.attrs.get('id')`; if set and non-empty, use it as the group id instead of `'graph0'` |
| 2242 | dot | `svg/g[1]/g[2]/@id` | `clust2` | `clust3` | Same AGSEQ numbering mismatch as 1453: port's per-type cluster counter gives `clust2` for the second cluster, but C's global AGSEQ gives `clust3` because an anonymous subgraph consumed AGSEQ 2 | **deep** | `src/render/svg-cluster.ts` + `src/gvc/device.ts` | Same fix as 1453 (global AGSEQ tracking) |
| 2258 | dot | `svg/g[1]/@id` | `graph0` | `G2` | Port hardcodes `graph0`; DOT source has `id = "G2"` at graph level; C reads it via `getObjId` | **simple** | `src/render/svg-graph.ts` + `src/gvc/device.ts` | Same fix as 2184: read `g.attrs.get('id')` for root graph SVG group id |
| 2497 | dot | `svg/g[1]/g[1]/@id` | `clust1` | `cluster_0_0` | Clusters in 2497.dot have explicit `id=cluster_0_0` and `id=cluster_1_0` DOT attributes; C `getObjId` reads the DOT `id=` attr first; port ignores it and uses sequential counter | **simple** | `src/render/svg-cluster.ts` | In `svgBeginCluster`, check `sg.attrs.get('id')`; if set, use it as the SVG group id instead of `'clust' + job.clusterId` |
| 2563 | dot | `svg/g[1]/g[1]/@class` | `class="node"` | `class="node node"` | DOT has `node[class="node"]` setting; C appends the DOT `class` attr to the SVG `class` string via `svg_print_id_class`; port emits the base kind only | **simple** | `src/render/svg-helpers.ts` | In `svgBeginNode`, append ` ` + escaped DOT `class` attr when `n.attrs.get('class')` is set and non-empty |
| 2592 | dot | `svg/g[1]/g[2]/@id` | `clust2` | `clust3` | Same AGSEQ numbering mismatch as 1453/2242 | **deep** | `src/render/svg-cluster.ts` + `src/gvc/device.ts` | Same fix as 1453 |
| 2613 | dot | `svg/g[1]/g[1]/@id` | `node1` | `bus01` | DOT node has `id="bus01"` attribute; C `getObjId` reads it first and uses it as SVG id; port always emits `node<seq>` | **simple** | `src/render/svg-helpers.ts` | In `svgBeginNode`, check `n.attrs.get('id')`; if set, use it as the SVG group id instead of `'node' + (n.id + 1)` |
| 2734 | dot | `svg/g[1]/g[1]/@class` | `class="node"` | `class="node entry"` | DOT node has `class="entry"` attribute; C appends it to SVG `class`; port emits base kind only | **simple** | `src/render/svg-helpers.ts` | Same fix as 2563: append DOT `class` attr in `svgBeginNode` |
| 42 | dot | `svg/g[1]/g[1]/@class` | `class="node"` | `class="edge"` | DOT has `outputorder=edgesfirst`; oracle renders all edges before nodes so `g[1]` is an edge group; port ignores `outputorder` and renders nodes first | **deep** | `src/gvc/device.ts` | Port `outputorder` graph attribute from `lib/common/emit.c:emit_graph`; add a pre-pass that re-orders the node/edge emit loop when `outputorder=edgesfirst` or `outputorder=nodesfirst` |
| 705 | dot | `svg/g[1]/g[1]/@id` | `clust1` | `clust2` | AGSEQ numbering mismatch: port starts at `clust1`, oracle emits `clust2` (root graph takes AGSEQ 1, first cluster takes AGSEQ 2 in this graph). DOT nodes also have `id=` attrs (e.g. `id="bus01"`) that the port ignores | **deep** | `src/render/svg-cluster.ts` + `src/gvc/device.ts` | Global AGSEQ fix (same as 1453); node `id=` attr fix (same as 2613) |
| graphs-arrows | dot | `svg/g[1]/g[11]/polygon[1]` | `<polygon fill="black" stroke="black" points="206.12,-31.84 …"/>` | `<ellipse fill="black" stroke="black" cx="198.76" cy="-31.25" rx="4" ry="4"/>` | Edge `Z->D` has `arrowhead=dot`; same root cause as 1408/1447_1: port emits polygon, C emits ellipse for the `dot` arrowhead type | **deep** | `src/layout/dot/edge-route-arrow.ts` + `src/render/svg-helpers.ts` | Same fix as 1408 |

---

## Summary

**Simple: 7** — 2183, 2184, 2258, 2497, 2563, 2613, 2734  
**Deep: 10** — 1408, 1447_1, 1453, 1622_0, 1880, 2242, 2592, 42, 705, graphs-arrows

### Simple cases grouped by shared root cause (Batch-2 fix candidates)

**Group S1 — DOT `id=` attr used as SVG group id (3 cases: 2184, 2258, 2497, 2613)**  
fixModule: `src/render/svg-graph.ts` (root graph), `src/render/svg-cluster.ts` (clusters), `src/render/svg-helpers.ts` (nodes + edges)  
fixPlan: Mirror C `getObjId`: read the DOT `id` attribute on each object first; fall back to generated `graph0` / `clust<N>` / `node<N>` / `edge<N>` only when absent. Single ≤30-line change touching three emit modules.  
Affects cases: 2184 (graph), 2258 (graph), 2497 (clusters), 2613 (node) — can all be fixed together.

**Group S2 — DOT `class=` attr appended to SVG `class` string (3 cases: 2183 partial, 2563, 2734)**  
fixModule: `src/render/svg-helpers.ts` (`svgBeginNode`, `svgBeginEdge`), `src/render/svg-cluster.ts` (`svgBeginCluster`), `src/render/svg-graph.ts` (page group)  
fixPlan: After emitting `class="<kind>"`, read the DOT `class` attr and append ` ` + xml-escaped value when non-empty — matching C's `svg_print_id_class`. One ≤10-line change per emit function.  
Affects cases: 2563 (node class), 2734 (node class), 2183 (cluster swimlane class).

**Group S3 — `stylesheet=` graph attr omits `<?xml-stylesheet?>` PI (1 case: 2183)**  
fixModule: `src/render/svg-graph.ts`  
fixPlan: In `svgBeginGraph`, after the XML declaration, check `g.attrs.get('stylesheet')`; if set and non-empty, emit `<?xml-stylesheet href="<val>" type="text/css"?>` before the DOCTYPE — matching C's `svg_begin_job`. ~5 lines.
