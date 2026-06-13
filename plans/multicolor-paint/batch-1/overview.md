# Batch 1 — gradient / two-color fills (foundational)

Ports the linear/radial gradient subsystem + the shared multicolor
color-list parser, and wires gradients into node, cluster, and
graph-background fills. After this batch, `fillcolor="c1:c2"` (and
`style=radial`) emit real `<defs><linearGradient>/<radialGradient>` +
`fill="url(#id)"` instead of the parity-render-styling first-solid
fallback. The 97 existing goldens stay byte-identical (gradient branches
are gated on multicolor ObjState).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| G1 | Multicolor parser + gradient color resolution ([G1-gradient-resolution.md](G1-gradient-resolution.md)) | sonnet | src/common/multicolor.ts (new), src/common/style-resolve.ts (+tests) | — | [ ] |
| G2 | Gradient SVG emitters + obj-state plumbing ([G2-gradient-emitters.md](G2-gradient-emitters.md)) | sonnet | src/render/svg-gradient.ts (new), src/render/svg-helpers.ts, src/gvc/job.ts (+tests) | — | [ ] |
| G3 | Wire node + cluster gradient ([G3-node-cluster-gradient.md](G3-node-cluster-gradient.md)) | sonnet | src/common/poly-gencode.ts, src/gvc/device.ts (+tests) | G1, G2 | [ ] |
| G4 | Wire graph bgcolor gradient ([G4-graph-bgcolor-gradient.md](G4-graph-bgcolor-gradient.md)) | sonnet | src/render/svg-graph.ts (+test) | G1, G2 | [ ] |

**Sequencing (single-writer-per-file):**
- Round 1: **G1 ‖ G2** — disjoint (multicolor.ts + style-resolve.ts vs
  svg-gradient.ts + svg-helpers.ts + job.ts).
- Round 2: **G3 ‖ G4** — disjoint (poly-gencode.ts + device.ts vs
  svg-graph.ts); both consume G1's resolver + G2's emitters/obj-state.

**Interface contract (G1 → G3/G4):** `resolveNodeFill` / `resolveClusterFill`
return a discriminated fill: `{ kind: 'none' } | { kind: 'solid'; color }
| { kind: 'linear'|'radial'; fillColor; stopColor; frac; angle }`.
`findStopColor(colorlist) → { fillColor; stopColor; frac } | null`.

**Interface contract (G2 → G3/G4):** setting `obj.fill = FillType.Linear`
(or `.Radial`), `obj.fillColor`, `obj.stopColor`, `obj.gradientFrac`,
`obj.gradientAngle`, then passing the shape's filled flag through the
existing `renderer.polygon/ellipse(..., filled=true, job)` makes
`emitStyle` emit the `<defs>` + `url(#id)`. G2 exports the gradient
emitter(s) and adds `linearGradId`/`radialGradId` to RenderJob.
