<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture Decisions

## D1 — Parse `size=`/`ratio=` at render-setup, not at graph_init {#d1}

**Context:** C parses these in `graph_init` (`input.c:600`) because string sizes
may be needed during layout. In this port, ratio-aspect *layout* is out of scope
(D3), so the only consumer of `size`/`filled` is render-time scaling.

**Decision:** Perform the parse inside `render()` (`gvc/device.ts:442`),
co-located with the `init_job_viewport` zoom computation, reading
`g.attrs.get('size')` / `g.attrs.get('ratio')` directly. This keeps the feature
**engine-agnostic** (the shared render path serves dot/neato/etc.) and confined
to one file, avoiding a per-engine `graph_init` seam.

**Consequences:** Easier — one site, all engines scale. Harder — diverges from
C's parse *location* (document with a `@see input.c:694` note). No behavior
difference because size does not affect layout in scope.

## D2 — `size` is inches → convert to points (×72) {#d2}

**Context:** The `size=` attribute is in inches (`size="6,6"` = 6in). The bb
(`job.bb`) is in points. `init_job_viewport` compares them directly, so `size`
must already be in points (C's `getdoubles2ptf` does the conversion — note the
`pt` in the name).

**Decision:** Multiply parsed `size` values by `POINTS_PER_INCH` (72) when
populating `drawing.size`. A lone `size="6"` means square (x=y). Trailing `!`
(`size="6,6!"`) sets `filled = true`.

**Consequences:** Pin the exact conversion + rounding against instrumented C if
the canary is off by a sub-point; `getdoubles2ptf` is the authority.

## D3 — Do NOT activate ratio-aspect layout reshaping {#d3}

**Context:** `layout/dot/position-bbox.ts` already implements
`aspectFillScale`/`aspectExpandScale`/`aspectValueScale`, gated on
`drawing.ratioKind`. Nothing currently sets `ratioKind`, so it is inert. Setting
`ratioKind = 'fill'|'expand'|'value'|'compress'` would activate it and move
nodes for the 24 `ratio=` graphs — untested code, regression risk, out of scope.

**Decision:** `init_job_viewport` needs only the **`filled` boolean** (`ratio=
fill` OR `size` had `!`). Derive `filled` directly; do **not** write
`drawing.ratioKind` from this mission (or, if a shared parse sets it, ensure the
layout pass that reads it has already run / is bypassed for the render-only
path). The zoom condition is:

```
Z = 1
if size.x > 0.001 and size.y > 0.001:        # user gave size
    if sz.x <= 0.001: sz.x = size.x          # degenerate-bb guards
    if sz.y <= 0.001: sz.y = size.y
    if size.x < sz.x or size.y < sz.y         # drawing too big, OR
       or (filled and size.x > sz.x and size.y > sz.y):  # filled & too small
        Z = min(size.x / sz.x, size.y / sz.y)
job.zoom = Z
```
where `sz = (job.bb.UR - job.bb.LL)` including pad, in points
(`emit.c:3369,3376-3383`).

**Consequences:** Keeps the mission to scaling only. If a `ratio=fill` corpus
graph still diverges on *positions* (not scale), that is the deferred
layout-aspect mission — log and move on, do not chase it here.

## D4 — SVG keeps inner coords full-size; group transform carries zoom {#d4}

**Context:** For SVG, C sets `GVRENDER_DOES_TRANSFORM`, so `gvrender_ptf`
returns points unscaled (`gvrender.c:422`) and the group `scale(Z)` does the
zoom. The port already mirrors this — `transformPoint` short-circuits on the
flag (`gvc/device.ts:59`). Raster/ptf devices scale via `job.zoom * devscale`
(already wired, `device.ts:62`).

**Decision:** Setting `job.zoom` must **not** change emitted SVG node/edge
coordinates. T2 changes only: (a) the group open `scale(1 1)` → `scale(Z Z)`
(`render/svg-graph.ts:84`), and (b) `emitSvgTag` `width`/`height`/`viewBox` →
size-fitted = `round(dim * Z)` (`render/svg-graph.ts:54`). Font-size stays
unscaled (the group transform shrinks glyphs visually; oracle keeps
`font-size="36"`). Verify no coordinate-level churn on the 278 byte-matches.

**Consequences:** Low blast radius; the raster ptf path is untouched and already
correct once `job.zoom` is set.

## D5 — Regression floor: gate scaling on `size` present {#d5}

**Context:** 278 rows currently byte-match. None set `size=` (else they would
not match at scale 1). Applying `Z=1` when no `size` is given leaves them
byte-identical.

**Decision:** When `size` is absent/degenerate, `Z` stays `1.0` and all emitted
bytes are unchanged. Acceptance includes **byte-match count ≥ 278, 0
regressions** (T3 regression scan). If any non-`size` row changes a single byte,
**stop** — the no-size path must be a pure no-op.

**Consequences:** Makes the feature opt-in by attribute presence; safe to merge.
