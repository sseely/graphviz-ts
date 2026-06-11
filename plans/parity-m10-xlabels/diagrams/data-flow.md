# Data flow — default head/tail label placement (the C path being ported)

```mermaid
sequenceDiagram
    participant Init as dot init (M9)
    participant Spl as dotSplines_
    participant GP as gvPostprocess
    participant AXL as addXLabels (T5)
    participant PL as placeLabels (T4)
    participant RT as R-tree (T1–T3)
    participant Emit as emit-edge (M9)

    Init->>Init: edge-label-init: head_label/tail_label created,<br/>has_labels |= HEAD_LABEL|TAIL_LABEL, set=0
    Spl->>Spl: route splines; edgeLabelsDone = true (dotsplines.c:471)
    GP->>AXL: addXLabels(g) (postproc.c:616)
    AXL->>AXL: guard: any unset external labels? (postproc.c:419-424)
    AXL->>AXL: build object_t[] (nodes as obstacles, set labels)<br/>+ xlabel_t[] seeded at edgeHeadpoint/edgeTailpoint
    AXL->>PL: placeLabels(objs, lbls, {bb, force})
    PL->>RT: insert obstacles; Hilbert-order labels;<br/>xladjust 9-candidate search per label
    PL-->>AXL: lbl.pos + set=1
    AXL->>AXL: write back: lp.pos = centerPt, updateBB(g, lp)
    GP->>GP: translate_drawing maps label pos per rankdir (M9)
    Emit->>Emit: label.set → <text> elements (childCount 3 → 5)
```
