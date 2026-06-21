# Deep case: graphs-user_shapes

- **Corpus path:** `graphs/user_shapes.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[1]/ellipse[1]`
- **Port:** `<ellipse cx="108" cy="-270" rx="27" ry="18">`
- **Oracle:** `<polygon points="135,-288 81,-288 81,-252 135,-252 135,-288">`
- **Root-cause group:** G10 — shapefile node bbox
- **Why deep:** Nodes with `shapefile=` (external image shapes) fall back to ellipse in port;
  oracle emits a rectangular polygon matching the node's computed bounding box. Full browser
  image loading is out of scope, but emitting the correct bbox polygon (rather than an ellipse)
  requires porting the shapefile shape-handling path in the node renderer.
- **Follow-on bucket:** `shapefile-node`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs shapefile shape-handling port in svg-node). Not fixed in this mission.
