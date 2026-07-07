# Batch 2 — Fix-loop protocol + pre-diagnosed mechanisms

## Protocol (per iteration)
1. **Observe.** `npx tsx test/corpus/xdot-walk.ts` reports one diverging item with
   an op-level `XdotDiff[]`. That diff is the discrepancy — enter diagnosis mode.
2. **Diagnose to root cause** (`~/.claude/rules/diagnosis.md`). Instrument before
   hypothesizing: dump the C oracle's op stream for that object
   (`GVBINDIR=/tmp/ghl dot -Txdot <input>`) and the port's, compare op-by-op.
   State the mechanism (cause, `file:line`, causal chain, what you ruled out)
   BEFORE editing.
3. **Fix at the origin.** Prefer the change at the mechanism's source over a
   symptom patch at the emit site. The origin is almost always the `XdotRenderer`
   class in `src/render/dot.ts`; only touch `src/gvc/device.ts` if the mechanism
   is genuinely in the shared emit-state / color-state machinery.
4. **Gate** (README quality gates). Run the SVG survey gate **only** when the fix
   touched `device.ts` or a shared helper.
5. **Commit** one fix: `fix(xdot): <mechanism>`. Append a decision-journal row.
6. **Repeat.**

## Guardrails
- **Layout is not in scope.** These graphs are SVG-conformant, so node coords and
  spline geometry are already correct. If a divergence's root cause is a layout
  value (not how it is emitted), STOP and ask — the premise is violated.
- **SVG must not regress.** `device.ts` is shared. Any device.ts fix that makes
  SVG `rules-gate.ts` report regressions > 0 → STOP.
- **Consecutive-fix rule.** Same location changed 3× without resolving the same
  divergence → STOP (architectural signal).
- **Irreducibles.** Font-metric ULP / platform libm noise within a hair of
  tolerance → record `{id, opClass, delta, rationale}` in
  `test/corpus/accepted-divergences-xdot.json`, continue.

## Pre-diagnosed mechanisms (from the a→b probe, verified 2026-07-06)

### F1 — xdot coordinates are y-up (no inversion)
**Symptom:** node `a` (pos 27,90) emits `_draw_="… e 27 18 …"` and `b` (pos
27,18) emits `e 27 90` — ellipse centers swapped; text `T` y likewise inverted
(a's text y=22.2 vs native 85.8).
**Mechanism:** `XdotRenderer` sets `this.yOff = g.info.bb.ur.y` and `xdotPoint`
emits `yOff - y` — the SVG y-down inversion. xdot uses the **layout coordinate
system (y-up), same as `pos`** — no inversion. `108 - 90 = 18` is exactly the
observed swap. Origin: `src/render/dot.ts` `beginGraph` (`this.yOff = …`) and the
`xdotPoint`/`xdotPoints` call sites in `ellipse/polygon/bezier/polyline/textspan`.
**Fix direction:** emit un-inverted coordinates for xdot (e.g. `yOff = 0`, or an
xdot-specific point emitter that passes layout coords through). One change clears
ellipse AND text coords. Confirm against native for a→b before moving on.

### F2 — pen/fill color from graphics state
**Symptom:** `a [color=red]` → port `_draw_` has `c 7 -#000000`; native `c 7
-#ff0000`.
**Mechanism:** `ellipse/polygon/bezier/polyline` hardcode
`xdotPenColor('#000000')` / `xdotFillColor('#000000')` — the renderer never reads
the current pen/fill color set by the `gvrender_set_pencolor` /
`set_fillcolor` callbacks. In C, `xdot_ellipse` et al. read `obj->pencolor` /
`obj->fillcolor`. Origin: `src/render/dot.ts` shape methods; the set-color state
may need wiring in `src/gvc/device.ts` (check whether the job/obj already carries
the resolved pen/fill color the SVG renderer uses — reuse that source of truth).
**Fix direction:** read the resolved current color from the same graphics-state
the SVG renderer reads; do not re-resolve. Verify red→`#ff0000` and that
default/uncolored nodes still emit `#000000`.

### F3 — emit-state routing (`_draw_` vs `_ldraw_` vs `_hdraw_`)
**Symptom (labels):** node label font+text land in `_draw_`, not `_ldraw_`
(`textspan` used `getBuf(job)` which returns `bufs[obj.emitState]`, and emitState
was still `NDraw` during label emit). **Symptom (edges):** edge `_draw_` /
`_hdraw_` empty — the `a -> b;` line has no draw attrs at all; native emits the
bezier `B 4 …` in `_draw_` and the arrowhead `P 3 …` in `_hdraw_`.
**Mechanism:** the emit-state (`obj.emitState`) that routes ops into the right
xbuf is not being switched to `NLabel`/`ELabel` during label emission, and the
edge draw path (spline bezier + arrowhead polygon) is not reaching `EDraw`/head-
draw. This is the shared emit-state machinery in `src/gvc/device.ts`
(`renderNode`/`renderEdge`/`renderOneLabel`) plus `XdotRenderer.getBuf`.
**Fix direction:** ensure the label-emit path sets the label emit-state and the
edge-draw path runs the spline + arrowhead callbacks under `EDraw`/head-draw —
mirror how the SVG renderer already produces these (SVG draws edges + labels
correctly, so the callbacks fire; the xdot buffer routing is what is wrong). This
is the fix most likely to touch `device.ts` → run the SVG gate.

### F4 — graph background, font + color canonicalization
**Symptoms:** (a) native emits graph `_draw_="c 9 -#fffffe00 C 7 -#ffffff P 4 …"`
(canvas fill) — port omits it. (b) font `-Times,serif` vs native `-Times-Roman`.
(c) color token `c 5 -black` vs native `c 7 -#000000` (named vs hex + wrong byte
count prefix).
**Mechanism:** (a) the graph-level background draw isn't emitted in `beginGraph`
/`GDraw` flush. (b) `xdotFont` passes the CSS-ish resolved family through; native
canonicalizes to the PostScript face name. (c) `xdotPenColor` emits the named
color verbatim; native emits canonical `#rrggbb` and the `N -` length prefix
counts the hex string. Origin: `src/render/dot.ts` `beginGraph`, `xdotFont`,
`xdotPenColor`/`xdotFillColor`.
**Fix direction:** emit the graph background op; canonicalize font face and color
to native's forms. Note: the comparator (T2) canonicalizes colors/fonts too, so
some of these may already compare-equal — fix only what the walker actually flags.

## After the pre-diagnosed set
Larger graphs will surface new op classes (dashed/bold `S` style ops, cluster
`_gdraw_`, gradient fills, `I` image ops, record/HTML port polylines). Each is a
fresh diagnosis → fix → commit iteration under the same protocol. Do not
pre-guess them; let the size-sorted walk reveal them in order.
