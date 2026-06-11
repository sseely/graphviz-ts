# Mission 10: emit.ts family is dead code in the live render path

## Observation: src/common/emit*.ts is an unwired parallel emission pipeline
- **Context**: T6 of mission 10 — the quarantined dot-head-tail-label golden
  still failed after placement (T4/T5) landed, with labels placed correctly
  (set=true, positions bit-exact vs the C ref) but no <text> in the SVG.
- **Finding**: The live render path is `src/gvc/device.ts` renderGraph →
  walkNodesAndEdges → renderer.beginEdge/endEdge (`src/render/svg.ts`),
  where endEdge emits only path + arrow polygons. The mission-9 ports of
  emit.c — `src/common/emit.ts`, `emit-edge.ts` (emit_end_edge incl.
  emitEdgeLabels for label/xlabel/head_label/tail_label), `emit-xdot.ts`
  (emit_label) — are imported ONLY by their own tests; nothing in the live
  pipeline calls them. Node labels go through shape codefn
  (poly-gencode.ts); cluster labels through renderClusterLabel in
  device.ts. Edge label text has NO live emission site: no manifest golden
  has ever had <text> inside an edge group, so the gap was invisible.
- **Impact**: Wiring edge-label emission (e.g. emitEdgeLabels from
  emit-edge.ts, or a device.ts equivalent of emit.c:emit_end_edge's label
  block) is the single remaining blocker for promoting
  dot-head-tail-label and for ALL edge label/xlabel/head/tail text output.
  Verify RenderJob type compatibility between the emit family and
  device.ts before wiring. Placement (mission 10 src/label/*,
  src/common/xlabels-place.ts) is verified bit-correct: head 'h'
  pos=(23.625,116.354) → svg (23.62,-111.3); tail 't'
  pos=(25.125,135.447) → svg (25.12,-130.4), both matching the C ref
  exactly (y = -(pos.y + dimen.y/2 - fontsize + 0.7 centerline)).
- **Confidence**: High (grep of all importers; live-path trace; numeric
  cross-check against the 15.0.0 ref SVG).
