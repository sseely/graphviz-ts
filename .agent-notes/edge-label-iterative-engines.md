# Edge labels under the neato-family engines (neato / fdp / sfdp)

## Observation: the neato-family engines skipped BOTH halves of the edge-label chain

- **Context**: 126 corpus ids (neato 43, fdp 37, sfdp 46) whose only diff was
  `edge/_ldraw_/structural`. Minimal repro `digraph { a -> b [label="x"] }`:
  native emits an edge `_ldraw_` + `lp` under -Kneato/-Kfdp/-Ksfdp, the port
  emitted neither, while the edge spline and node positions matched byte-for-byte.
- **Finding**: Two independent gaps in the same chain, both engine-init defects:
  1. `common_init_edge` was never run for these engines. C's
     `neato_init_node_edge` (neatoinit.c:142), `fdp_init_node_edge`
     (fdpinit.c:73), and `sfdp_init_node_edge` (sfdpinit.c:44) each run a
     *second* loop over out-edges calling `common_init_edge(e)`, which creates
     `ED_label(e)` and ORs `GD_has_labels |= EDGE_LABEL`. The port's
     `commonInitNodeEdge` (src/common/nodeinit.ts:332) despite its name only
     loops over **nodes** — it has no edge loop at all. So the edge label object
     never existed and `has_labels` stayed 0.
  2. `gv_postprocess` was never called for these engines. C's `neato_layout`
     (neatoinit.c:1440), `fdp_layout` (layout.c:1076, with `allowTranslation=0`)
     and `sfdp_layout` (sfdpinit.c:295) all end in it; it runs `addXLabels`,
     which is what *positions* edge labels for every engine except dot. (dot
     sets `ED_label(e)->pos` itself during its spline pass and then sets
     `EdgeLabelsDone`, which is precisely the flag that makes `addXLabels`
     early-return under dot.) The port's neato/fdp/sfdp pipelines stopped at
     `placeGraphLabel`.
- **Impact**:
  - `commonInitNodeEdge` is misnamed: it is `common_init_node` only. Any engine
    added later must call `initEdgeLabels` (the port's `common_init_edge`)
    explicitly, as dot/circo/twopi/osage already do. Grepping for
    `commonInitNodeEdge` is NOT sufficient to confirm edge init.
  - `addXLabels` is not an "xlabel-only" pass — it is the **normal** edge-label
    placement path for every engine but dot. Anything reported as "engine X has
    no edge labels" should check the `has_labels & EDGE_LABEL` gate first
    (xlabels-place.ts:444), because the gate silently returns when
    `common_init_edge` never ran.
  - Turning on `common_init_edge` for these engines also turns on the port block
    (`initEdgePorts`). Verified no spline change: `_draw_`/`_hdraw_` remained
    byte-identical to native on a 155-render sample.
  - Wiring `gvPostprocess` also fixed 12 bounding boxes: `addXLabels`'
    `updateBB` write-back grows `GD_bb` around placed edge labels, which the
    neato family was previously missing entirely.
  - The port's xdot emitter never writes the `lp=` attribute for **any** engine
    (dot included, and dot is conformant) — the corpus comparator ignores it.
    The underlying `label.pos` now matches native's `lp` exactly; do not treat
    the missing `lp=` attribute as a neato-family defect.
- **Confidence**: High. Established by instrumenting `addXLabels` in the C tree
  (`n_nlbls`/`n_elbls`/`n_objs`/obj table/placed pos) and mirroring the same
  probes in the port: every value matches (fdp differs only in the 4th decimal
  from a pre-existing position ULP).
