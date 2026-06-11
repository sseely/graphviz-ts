# Post-M10: remaining label gaps are CREATION-side, not emission

## Observation: node xlabel, edge label, edge xlabel, graph label never created
- **Context**: Mission 10 follow-up probe (.probes/followup-gaps.ts,
  followup-state.ts) after edge head/tail label emission was wired.
- **Finding**: For `A [xlabel="nx"]`, `A -> B [label="el"]`,
  `A -> B [xlabel="ex"]`, and `label="gl"` (graph), the C binary emits
  the text; the port emits nothing. Model state after layout shows all
  four labels ABSENT — n.info.xlabel, e.info.label, e.info.xlabel,
  g.info.label are never created. M9's edge-label-init covers ONLY
  headlabel/taillabel. C creates these in common_init_node /
  common_init_edge (make_label) and do_graph_label.
- **Finding**: These are NOT wiring jobs:
  - edge `label=` affects LAYOUT — C builds virtual label nodes during
    ranking (class2.c) and dotsplines edge_normalization; geometry
    changes, new goldens needed.
  - graph `label=` expands bb via do_graph_label before translation.
  - node/edge `xlabel` creation feeds the already-ported addXLabels
    (placement verified bit-correct in M10); node-side xlabel EMISSION
    (emit.c emit_node ND_xlabel block) is also unwired in the live path
    — wire it in the same mission where creation makes it testable
    end-to-end.
- **Finding**: emit-family dead-code map (definitive grep): only
  emit-types.ts is imported by live code (types). emit.ts, emit-node,
  emit-edge, emit-cluster, emit-xdot, emit-style, emit-bb, emit-coord,
  emit-shape (~1900 lines + emit.test.ts) have zero live importers.
  The live path (gvc/device.ts + render/svg*.ts) is the
  golden-validated emit.c port; the family has drifted (incompatible
  RenderJob shapes).
- **Impact**: Next label mission should bundle: creation
  (common_init_node/edge make_label, do_graph_label), edge-label
  virtual-node layout, node-xlabel emission, new goldens — and decide
  the emit-family fate (fold unique logic into the live path, delete
  the rest; do not maintain two emit.c ports).
- **Confidence**: High (C oracle 15.0.0 cross-check; model-state probe;
  importer grep).
