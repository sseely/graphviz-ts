# Architecture Decisions (pre-made — approved by Scott 2026-06-13)

| ID | Decision |
|----|----------|
| AD1 | **Gradient ids are per-RenderJob monotonic counters.** Add `linearGradId` and `radialGradId` to RenderJob, starting at 0 and incrementing per emitted gradient (C uses process-`static int gradId`/`rgradId`; a fresh `dot -Tsvg` process starts at 0, so a per-RenderJob counter reproduces `l_0`, `r_0`, `l_1`… exactly). Ids are `l_<n>` / `r_<n>`, optionally prefixed `<obj.id>_` when the object has an id (matches svg_gradstyle/svg_grstyle). @see plugin/core/gvrender_core_svg.c:572 (static gradId). |
| AD2 | **`<defs>` is emitted inline immediately before its shape element**, inside the shape emitter (svgEllipse/svgPolygon/svgBezier), exactly as C's svg_ellipse/svg_polygon/svg_bezier call svg_gradstyle/svg_rgradstyle then emit the element. NOT hoisted to a single document-level `<defs>`. Byte-parity with the C refs depends on this ordering. @see gvrender_core_svg.c:650-690. |
| AD3 | **emitStyle/paintStr gain an additive gradient branch** gated on `obj.fill ∈ {FillType.Linear, FillType.Radial}`. When gradient, fill emits `url(#[id_]l_N)` / `url(#[id_]r_N)`; the solid/none/stroke/penwidth/dash logic is UNCHANGED (the 97 existing goldens — all solid/none — stay conformant). This SUPERSEDES the parity-render-styling AD4 "don't touch emitStyle" only for the new gradient branch; the solid path is still frozen. @see gvrender_core_svg.c:svg_grstyle (fill url branch). |
| AD4 | **One shared multicolor color-list parser**, built FIRST. Port `parseSegs` + the `colorsegs_t` shape (lib/common/emit.c:470) into `src/common/multicolor.ts` as part of **G1** (because C's `findStopColor` calls `parseSegs`). It parses `"c1;f1:c2;f2:…"` (colors with optional `;weight` fractions) into segments. Consumed by `findStopColor` (G1), stripedBox/wedgedEllipse (S1), and multicolor() edges (M1) — no duplicate parser. `findStopColor` (the 2-color + frac gradient wrapper, emit.c:4335) lives in `src/common/style-resolve.ts` and imports the parser. |
| AD5 | **New module files keep `svg-helpers.ts` under the 500-line cap.** `src/render/svg-gradient.ts` holds get_gradient_points + svg_gradstyle/svg_rgradstyle/svg_print_stop ports; `src/render/svg-multicolor.ts` holds stripedBox/wedgedEllipse ports. svg-helpers.ts only gains the small emitStyle gradient branch + delegating calls. |
| AD6 | **Two-color fills become gradients only when C does.** A plain `fillcolor="c1:c2"` with no gradient angle is still a LINEAR gradient in C (findStopColor returns frac, GRADIENT path) — NOT a solid. Verify each site against the oracle: `findStopColor` returning true ⇒ GRADIENT (or RGRADIENT if `style=radial`). `style=striped`/`wedged` ⇒ multicolor regions, NOT gradient. The parity-render-styling first-color fallback is removed at exactly the sites where findStopColor/parseSegs now drive emission. |
| AD-C1 | (Carried M9–parity.) Append-only manifest entries with provenance; never modify existing refs/manifest/tolerances; refs from installed graphviz 15.0.0 only. |

## Locked constraints (not decisions)

- C function boundaries + @see cites per ported block (CLAUDE.md).
- YAGNI does not apply: the C source defines completeness. No scoped
  omissions remain (this mission closes the gradient/multicolor gaps);
  the only deferred item is the box-node edge-spline 0.11pt layout/libm
  divergence (a separate concern, not multicolor).
- Hot-loop GC: gradient/stripe emission runs per styled object; reuse
  buffers where C does; no per-shape garbage in the walk (quality-bar
  line, not a gate).
- Byte-stability is the hardest gate: the 97 existing goldens are
  solid/none-styled and MUST stay conformant. The gradient/multicolor
  branches are gated on multicolor ObjState; default/solid objects never
  enter them.

## Operational readiness

Observability: N/A — library; the gate suite is the functional SLI (tsc
clean, vitest 0 failed, byte-stability probe, C-oracle compare).
Rollback: **Reversible** (git revert, one commit per task, no
migrations). Scalability: N/A beyond the hot-loop constraint. Backwards
compat: SVG output gains content (convergence to C) for multicolor
graphs; solid/unstyled output unchanged; no API breakage (ObjState +
gradient ids are internal).

## Known follow-up (out of scope)

- Box-node edge-spline 0.11pt divergence (layout/libm; tolerance+pin per
  M8, handled separately).
