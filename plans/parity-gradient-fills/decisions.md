# Architecture Decisions — parity-gradient-fills

| ID | Decision |
|----|----------|
| AD1 | **Deterministic gradient IDs: use obj->id + per-render counter reset.** C uses `static int gradId` and `static int rgradId` (plugin/core/gvrender_core_svg.c:577,614) — file-static counters that increment monotonically across the SVG output. C's id format is `<obj->id>_l_<gradId>` for linear (e.g. `node1_l_0`) and `<obj->id>_r_<rgradId>` for radial (e.g. `node1_r_0`). When `obj->id` is NULL the prefix is omitted (HTML-table cell case: `l_0`). The TS port MUST reset both counters to zero at the start of each SVG render job (not per-graph, not per-file: per `job.write` session), matching C's file-static behavior within one render run. Counters live in the new `src/render/svg-gradient.ts` module, exported as module state reset by a `resetGradientCounters()` call from the job/render pipeline entry point. This is the key determinism decision — golden byte-stability depends on it. |
| AD2 | **Gradient `<defs>` emitted immediately before the shape element.** C writes `<defs>...<linearGradient>...</defs>` then the shape element in the same output stream — the defs are inline, local to the shape, not hoisted to an SVG-level `<defs>` block. This means each gradient-filled shape emits its own `<defs>` block just before itself. The TS port replicates this exactly in `svgEllipse`, `svgPolygon`, `svgBezier` when `FillType.Linear` or `FillType.Radial` is detected. Do not hoist to a document-level `<defs>`. (@see plugin/core/gvrender_core_svg.c:585,625 — `<defs>` emitted inside `svg_gradstyle`/`svg_rgradstyle`, called before `svg_grstyle`.) |
| AD3 | **`get_gradient_points` is a pure geometry function — port inline into `svg-gradient.ts`.** C's `get_gradient_points` (lib/common/utils.c:1446) computes the two endpoints of the gradient line from the bounding-box of the shape points and the angle. It is used only in the SVG renderer's `svg_gradstyle`. Port it as a pure function in the new gradient module; do not add it to `utils.ts` (which has no current callers in this path). |
| AD4 | **Radial gradient uses percentage units; linear uses `userSpaceOnUse`.** C emits `<radialGradient cx="50%" cy="50%" r="75%" fx="<n>%" fy="<n>%">` (plugin/core/gvrender_core_svg.c:630-632) with `gradientUnits` absent (defaults to `objectBoundingBox`), while `<linearGradient gradientUnits="userSpaceOnUse" x1=... y1=... x2=... y2=...>` uses absolute coordinates from `get_gradient_points`. Port exactly — do not normalize to one unit system. The difference is intentional and affects rendering. |
| AD5 | **`emitStyle` extended: when `obj.fill === FillType.Linear` or `.Radial`, write `fill="url(#id)"` instead of the solid `paintStr`.** The new gradient module returns the `<defs>` block and the `url(#id)` reference string; `emitStyle` (src/render/svg-helpers.ts) uses the returned ref string. The gradient defs string is written by the caller before `job.write('<ellipse...')` etc. This keeps the "emit defs, then shape" order matching C. AD4 from parity-render-styling (do not change emission logic gratuitously) is respected — the change is additive: a new branch for `FillType.Linear/Radial`. |
| AD-C1 | (Carried M9–M12, render-styling.) Append-only manifest entries with provenance; never modify existing refs/manifest/tolerances; refs from installed graphviz 15.0.0 only. |

## Locked constraints (not decisions)

- C function boundaries + @see cites per ported block (CLAUDE.md).
- The `parseGradientSpec` function in `src/common/htmltable-emit-fill.ts`
  already parses `"c1:c2"` → `[c1, c2]`. Reuse it in the gradient
  path rather than re-implementing color-list parsing. The full
  fractional-stop form (`"c1;0.3:c2"`) is handled by `findStopColor`
  in C (emit.c:4335) — port `findStopColor`-equivalent into
  `src/render/svg-gradient.ts` as needed for the `gradientFrac` value.
- `FillType.Linear` and `FillType.Radial` are ALREADY defined in
  `src/gvc/context.ts:39`. `ObjState.stopColor`, `.gradientAngle`,
  `.gradientFrac` are ALREADY in `src/gvc/job.ts:101-103`. This
  mission uses them — it does NOT add new fields to `ObjState`.
- Stop transitions: C emits two `<stop>` elements. When `frac > 0`,
  first stop is at `frac - 0.001`, second at `frac`. When `frac == 0`,
  first stop is at `0`, second at `1`.
  (plugin/core/gvrender_core_svg.c:601-602 for linear;
  :634-635 for radial which always uses 0 and 1.)
- Hot-loop GC: gradient emission creates no heap objects beyond the
  string writes (matches C's stack-allocated temp arrays). Counter
  reset happens once per render, not per shape.

## Open questions for Scott

1. **Striped/wedged scope (T5):** `wedgedEllipse` and `stripedBox`
   in emit.c are multicolor-stripe fills (not gradients), but they
   depend on the same `parseSegs` color-list infrastructure. They are
   NOT in the current TS source. Porting them is significant work
   (bezier arc generation for wedges). T5 is scoped as "port
   wedgedEllipse + stripedBox" but may need to be its own follow-on
   mission if the bezier arc math is too large. The brief scopes T5
   here; flag if you want it deferred.
2. **HTML-table cell-level BGCOLOR gradient (T4):** M12 stored
   `GRADIENTANGLE` (AD4 deferral). The cell's `BGCOLOR` reaches
   emission via `withHtmlPaint`. Does gradient emission apply to
   individual cells, or only to the outer TABLE element? C's
   `emit_html_cell` (htmltable.c) calls the same `setFill`/gradient
   path as the table. T4 should handle both.
3. **Golden count target:** Targeting ~12 new goldens covering
   node-linear, node-radial, node-angled, cluster-gradient,
   graph-bgcolor-gradient, html-table-gradient, striped, wedged.
   Raise if you want denser coverage.

## Operational readiness

Rollback: **Reversible** (git revert, one commit per task, no
migrations). Backwards compat: SVG output for gradient-bearing attrs
changes from first-solid to true gradient — this is intentional
parity convergence, not breakage. Unstyled / solid-fill output is
unchanged (golden byte-stability). No API breakage (all internal).
