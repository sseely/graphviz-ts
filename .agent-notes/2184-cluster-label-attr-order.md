<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 2184 — cluster label/font inheritance must respect declaration order

- **Context**: 2184 diverged (childCount: port drew the root graph label
  "My Cool Graph" 4× — once per unlabeled cluster — and gave cluster2a's "C2"
  label fill=red). The root `graph [label=... fontcolor=red]` is the LAST
  statement, declared AFTER all clusters.
- **Finding**: DOT graph-attr defaults are ORDER-sensitive — a `graph [label=…]`
  applies only to subgraphs created AFTER it (cgraph copies the parent dict's
  defvals at agsubg). The port's graphAttrInherited (graph-label.ts) did a LIVE
  parent walk, so clusters declared before the root label still inherited it
  (label + fontcolor=red). C does not.
- **Fix**:
  1. builder.ts: at subgraph OPEN, snapshot the enclosing graph-attr defaults
     (effectiveGraphDefaults: scope→root, own attrs, first-found wins) into
     sg.graphDefaultsSnapshot. After the body, SEED the label-family keys
     (label/fontname/fontsize/fontcolor) from the snapshot into sg's OWN attrs
     (body wins). Seeding into attrs is load-bearing: the dot layout rebuilds
     cluster graphs through multiple paths (findClusters AND rank-dot2
     newrank) and copies attrs but NOT the snapshot field, so a snapshot-only
     approach is lost before doGraphLabel (regressed 2592's Arial cluster fonts).
  2. graph.ts: add graphDefaultsSnapshot field.
  3. graph-label.ts: graphAttrInherited reads own attr ?? snapshot (no live walk).
- **Result**: 2184 diverged → BYTE-MATCH (root label once; C2 black), 0
  regressions. 1323/1323_1 (label declared BEFORE nested clusters) still
  byte-match; 2592 (Arial inherited before clusters) unchanged. byte-match
  487→488. Supersedes the live-walk in [[1323-flat-adjacent-record-edge-done]].
- **Confidence**: High — byte-match + cross-checked both order directions.
