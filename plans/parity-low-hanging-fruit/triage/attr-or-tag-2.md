# Triage: attr-or-tag, part 2 of 2

All 16 cases use `dot` engine (corpus-manifest confirms `dot` for all, including the
`_circo` and `_twopi` suffixed filenames — those files contain pre-laid-out DOT with
`pos=` attributes, so they render under the dot engine regardless of name).

| id | engine | firstDiffPath | port value | oracle value | root cause | verdict | fixModule | fixPlan |
|----|--------|---------------|------------|--------------|------------|---------|-----------|---------|
| graphs-b7 | dot | svg/g[1]/g[2]/@id | `clust2` | `clust3` | Cluster SVG ID uses AGSEQ (cgraph sequence number). b7.gv reuses the name `cluster_1` in two different subgraphs, so AGSEQ for the second cluster skips a number; port uses a sequential 1-based counter instead | simple | src/render/svg-id.ts (or wherever cluster IDs are emitted) | Use AGSEQ of the subgraph object for cluster IDs, matching C emit.c:247 (`agxbprint(xb, "%s%ld", pfx, AGSEQ(obj))`) |
| graphs-b79 | dot | svg/g[1]/g[3]/polygon[1] | `<polygon points="78.1,-21.5 88.1,-18 78.1,-14.5 78.1,-21.5">` | `<ellipse ...>` | `arrowhead=dot` must render as a filled ellipse, not a polygon arrowhead; port emits a 4-point polygon (normal arrow shape) instead | deep | src/render/svg-arrowhead.ts | Port the `dot`/`odot` arrowhead shapes from arrowEndClip as filled/open ellipses; C uses `emit_ellipse` for these types |
| graphs-newarrows | dot | svg/g[1]/g[11]/polygon[1] | `<polygon points="206.12,-31.84 195.68,-30.06 202.73,-37.96 206.12,-31.84">` | `<ellipse ...>` | Same as graphs-b79: `arrowhead=dot` (edge Z->D) emits polygon instead of ellipse | deep | src/render/svg-arrowhead.ts | Same fix as graphs-b79 |
| graphs-rd_rules | dot | svg/g[1]/g[5]/polygon[35] | `<polygon points="134,-98 134,-182 206,-182 206,-98 134,-98">` | `<path d="M146,-98C146,-98 194,-98 194,-98 200,-98 206,-104 206,-110 ...">` | Port emits an extra bounding polygon (35th) for the HTML table node `tbl1100` that uses `style=rounded`; oracle emits a rounded-corner path for the outer border instead of a rectangle polygon | deep | src/render/svg-html-table.ts | Port the rounded-corner path (`M...C...`) for HTML table outer border with `style=rounded`; C uses `render_corner_arc` (emit.c) |
| graphs-root | dot | svg/g[1]/g[3]/polygon[1] | `<polygon points="31134.78,-250.56 31142.87,-243.73 31132.28,-244.02 31134.78,-250.56">` | `<ellipse ...>` | Same as graphs-b79: edge with `arrowhead=dot` (from pre-laid-out pos data) emits polygon instead of ellipse | deep | src/render/svg-arrowhead.ts | Same fix as graphs-b79 |
| graphs-triedds | dot | svg/g[1]/g[3]/@id | `edge1` | `0` | Edge SVG IDs use a 1-based sequential counter in port; oracle uses AGSEQ (0-based in this graph because edges carry explicit `id=0,1,...` attributes that become AGSEQ) | simple | src/render/svg-id.ts | Use AGSEQ for edge IDs matching C emit.c:242-247; when the dot source sets `id=N` on edges, AGSEQ reflects that value |
| graphs-user_shapes | dot | svg/g[1]/g[1]/ellipse[1] | `<ellipse cx="108" cy="-270" rx="27" ry="18">` | `<polygon points="135,-288 81,-288 81,-252 135,-252 135,-288">` | Nodes with `shapefile=` (external image shapes) fall back to ellipse in port; oracle emits a rectangular polygon bounding box as the shape placeholder | deep | src/render/svg-node.ts | Port shapefile shape handling: emit polygon bbox when shapefile is set; browser image loading is a secondary concern |
| linux.x86-arrows_dot | dot | svg/g[1]/g[11]/polygon[1] | `<polygon points="206.12,-31.84 195.68,-30.06 202.73,-37.96 206.12,-31.84">` | `<ellipse ...>` | Same as graphs-b79/newarrows: `arrowhead=dot` (edge Z->D) emits polygon instead of ellipse | deep | src/render/svg-arrowhead.ts | Same fix as graphs-b79 |
| linux.x86-root_circo | dot | svg/g[1]/g[3]/polygon[1] | `<polygon points="9825.26,-259.35 9814.81,-257.57 9821.87,-265.48 9825.26,-259.35">` | `<ellipse ...>` | Same `arrowhead=dot` ellipse-vs-polygon issue; input file is pre-laid-out with `pos=` attributes, rendered by dot engine | deep | src/render/svg-arrowhead.ts | Same fix as graphs-b79 |
| linux.x86-root_twopi | dot | svg/g[1]/g[3]/polygon[1] | `<polygon points="9825.26,-259.35 9814.81,-257.57 9821.87,-265.48 9825.26,-259.35">` | `<ellipse ...>` | Same as linux.x86-root_circo (same source file with same `arrowhead=dot` edge) | deep | src/render/svg-arrowhead.ts | Same fix as graphs-b79 |
| macosx-arrows_dot | dot | svg/g[1]/g[11]/polygon[1] | `<polygon points="206.12,-31.84 195.68,-30.06 202.73,-37.96 206.12,-31.84">` | `<ellipse ...>` | Same as linux.x86-arrows_dot (identical input graph, same arrowhead=dot gap) | deep | src/render/svg-arrowhead.ts | Same fix as graphs-b79 |
| nshare-arrows_dot | dot | svg/g[1]/g[11]/polygon[1] | `<polygon points="206.12,-31.84 195.68,-30.06 202.73,-37.96 206.12,-31.84">` | `<ellipse ...>` | Same as linux.x86-arrows_dot | deep | src/render/svg-arrowhead.ts | Same fix as graphs-b79 |
| nshare-root_circo | dot | svg/g[1]/g[3]/polygon[1] | `<polygon points="9829.26,-259.35 9818.81,-257.57 9825.87,-265.48 9829.26,-259.35">` | `<ellipse ...>` | Same as linux.x86-root_circo (slightly different x coords from different pre-layout run; same root cause) | deep | src/render/svg-arrowhead.ts | Same fix as graphs-b79 |
| nshare-root_twopi | dot | svg/g[1]/g[3]/polygon[1] | `<polygon points="9829.26,-259.35 9818.81,-257.57 9825.87,-265.48 9829.26,-259.35">` | `<ellipse ...>` | Same as nshare-root_circo | deep | src/render/svg-arrowhead.ts | Same fix as graphs-b79 |
| share-triedds | dot | svg/g[1]/g[3]/@id | `edge1` | `0` | Same as graphs-triedds: edge IDs use 1-based counter, oracle uses AGSEQ | simple | src/render/svg-id.ts | Same fix as graphs-triedds |
| windows-triedds | dot | svg/g[1]/g[3]/@id | `edge1` | `0` | Same as graphs-triedds: edge IDs use 1-based counter, oracle uses AGSEQ | simple | src/render/svg-id.ts | Same fix as graphs-triedds |

## Summary

**Simple: 4 cases** (2 distinct root causes)
**Deep: 12 cases** (3 distinct root causes)

### Simple root-cause groups

1. **Edge ID uses 1-based counter instead of AGSEQ** — `graphs-triedds`, `share-triedds`, `windows-triedds` (3 cases)
   C emit.c line 242/247: edge ID is `"edge%ld" % AGSEQ(edge)`. When DOT source has `id=0` on edges, AGSEQ is 0. Port generates `edge1/edge2/...` from a sequential counter, ignoring AGSEQ.

2. **Cluster ID uses 1-based counter instead of AGSEQ** — `graphs-b7` (1 case)
   Same mechanism: C uses AGSEQ for subgraph cluster IDs. When `b7.gv` reuses the cluster name `cluster_1` in two different scopes, cgraph assigns non-contiguous AGSEQ values, so oracle produces `clust1/clust3`, skipping `clust2`. Port uses a 1-based counter producing `clust1/clust2`.

### Deep root-cause groups

3. **`arrowhead=dot`/`arrowhead=odot` emits polygon instead of ellipse** — `graphs-b79`, `graphs-newarrows`, `graphs-root`, `linux.x86-arrows_dot`, `linux.x86-root_circo`, `linux.x86-root_twopi`, `macosx-arrows_dot`, `nshare-arrows_dot`, `nshare-root_circo`, `nshare-root_twopi` (10 cases)
   C renders the `dot` arrowhead as a filled circle (ellipse SVG element); the `odot` variant is an open circle. Port currently emits a 3-point polygon (the normal arrowhead shape) for these cases. Fix requires porting the `dot`/`odot` arm of the arrowhead rendering path in `makearrow`/`arrow_gencode` (C: `arrowhead.c`).

4. **HTML table `style=rounded` outer border emits polygon instead of rounded-corner path** — `graphs-rd_rules` (1 case)
   Port emits a 5-point rectangular polygon as the outer border of rounded HTML tables. Oracle emits a `<path>` with cubic bezier corner arcs (C: `render_corner_arc` in emit.c). This is an HTML table rendering gap for the `style=rounded` attribute.

5. **`shapefile=` node falls back to ellipse instead of polygon bounding box** — `graphs-user_shapes` (1 case)
   Port lacks shapefile support and falls back to the default ellipse shape. Oracle emits a rectangular polygon matching the node's computed bounding box. Full image/shapefile support is out of scope for browser environments, but emitting the bbox polygon (rather than an ellipse) is the minimal correct behavior.

### Notes on circo/twopi cases

`linux.x86-root_circo`, `linux.x86-root_twopi`, `nshare-root_circo`, `nshare-root_twopi` — despite the `_circo`/`_twopi` filename suffixes, the corpus manifest assigns these to the `dot` engine. The input files are pre-laid-out DOT (contain `pos=` coordinates for every node and edge), so the dot engine renders them without running a layout algorithm. The divergence is purely the `arrowhead=dot` ellipse-vs-polygon issue (#3 above), not an engine-support gap. These are **not** out-of-scope-engine cases.
