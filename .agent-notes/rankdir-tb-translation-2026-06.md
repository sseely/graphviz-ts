# Recon: rankdir=TB translation mechanism

Task: T4 — locate the port's existing TB coordinate translation for T6 (gv_postprocess port).

---

## Observation: No postprocess pass in dot layout
- **Context**: Tracing the dot layout pipeline from `dotLayoutEntry` through `dotLayoutPipeline` → `dotPhasePost`.
- **Finding**: `src/layout/dot/index.ts:117-142` — `dotLayoutPipeline` calls `dotPhaseInit`, `dotRank`, `dotMincross`, `dotPosition`, `dotPhasePost`. None of these calls `normalizeGraphBB`, `shiftOneGraph`, or any translate-to-origin function. `dotPosition` (`src/layout/dot/position.ts:213`) calls `placeGraphLabel` and `setAspect` which sets `g.info.bb` via `recBb` (`src/layout/dot/position-bbox.ts:85`) — but the bb.ll is **not** zeroed. The dot engine leaves `g.info.bb.ll` wherever the layout placed it (often non-zero).
- **Impact**: The TB-case `Offset = GD_bb(g).LL` / translate-drawing pass is entirely absent from dot. There is no per-engine translate-to-origin for dot.
- **Confidence**: High

---

## Observation: TB translation is performed by svgBeginGraph via the SVG group transform
- **Context**: Tracing how coordinates reach SVG output for a TB graph.
- **Finding**: `src/render/svg-graph.ts:116-130` (`svgBeginGraph`):
  1. Sets `job.devscale = { x: 1, y: -1 }` (Y-flip: Graphviz y-up → SVG y-down).
  2. Computes `tx = SVG_PAD - bb.ll.x` and `ty = bb.ur.y + SVG_PAD`.
  3. Emits `<g transform="scale(1 1) rotate(0) translate(tx ty)">`.

  The translation `tx = SVG_PAD - bb.ll.x` directly subtracts `bb.ll.x`, which is exactly what C's `Offset = GD_bb(g).LL` + subsequent `ND_coord -= Offset` achieves. But here the shift is applied lazily via the SVG `<g>` group transform rather than by mutating node coordinates. The `ty` also maps the Graphviz y-up origin to SVG y-down space in one step.

  This is the **only** place the TB-case normalization offset is handled for the dot engine.
- **Impact**: This is what T6 must replace (or preserve under the conditional path). The mechanism is a lazy SVG-level translate, not a coordinate-mutation pass on the graph model.
- **Confidence**: High

---

## Observation: transformPoint uses job.translation = {0,0} always
- **Context**: `src/gvc/device.ts:35-47` (`transformPoint`), called for every node/edge coordinate before SVG emission.
- **Finding**: `transformPoint` uses `job.translation.x/y`, which defaults to `{x:0, y:0}` (`src/gvc/job.ts:192`) and is **never set** anywhere in production code (only in `src/gvc/device.test.ts:34`). So the per-point translation component of `transformPoint` contributes nothing; the only operative transformation is `devscale.y = -1` applied via `applyScale`.
- **Impact**: The SVG group `translate()` in `svgBeginGraph` is the sole mechanism normalizing the bb.ll offset. `transformPoint` does not participate in the TB normalization at all.
- **Confidence**: High

---

## Observation: Other engines perform explicit translate-to-origin before render
- **Context**: Surveying all layout engines for postprocess equivalents.
- **Finding**: Engines that do call an origin-normalize function **before** `render()`:
  - `src/layout/patchwork/index.ts:336-351` — `translateDrawing(g)` shifts `g.info.bb.ll` to (0,0) via `shiftOneGraph`.
  - `src/layout/sfdp/index.ts:151-155` — inline `postprocess()` calls `shiftOneGraph(g, -bb.ll.x, -bb.ll.y)` then recomputes bb.
  - `src/layout/neato/index.ts:212-214` — `layoutComponents` path calls `shiftOneGraph(g, -bb.ll.x, -bb.ll.y)`.
  - `src/layout/neato/init.ts:438-442` — `neatoTranslate` shifts positions (not coords) to origin.

  Engines that do **not** call normalize-to-origin before render:
  - `dot` — relies entirely on `svgBeginGraph`'s `tx = SVG_PAD - bb.ll.x`.
  - `circo`, `twopi`, `fdp`, `osage` — these shift internally or leave bb.ll potentially non-zero; all rely on the SVG group translate as their TB-case normalizer.
- **Impact**: The port has a **split strategy**: some engines mutate coordinates (model-level normalize), others rely on the SVG group translate. T6 must handle both cases.
- **Confidence**: High

---

## Observation: The BB the SVG group translate uses comes from render()'s job.bb setup
- **Context**: `src/gvc/device.ts:181-190` (`render` function).
- **Finding**: `render()` sets `job.bb` from `g.info.bb` (or `computeSubgraphBB` if bb is invalid). `svgBeginGraph` then reads `job.bb` to compute `tx`/`ty`. So the SVG group translate always reflects whatever `g.info.bb` is at render time.
  - For dot: `g.info.bb.ll` may be non-zero → `tx` absorbs the offset.
  - For patchwork/sfdp (post-translate): `g.info.bb.ll = {0,0}` → `tx = SVG_PAD` (no offset component).
- **Impact**: A ported `gv_postprocess` that sets `Offset = bb.LL` and mutates all coordinates (shifting them by `-bb.LL`) would produce `g.info.bb.ll = {0,0}` post-call. At that point `svgBeginGraph`'s `tx = SVG_PAD - 0 = SVG_PAD`, same as the patchwork/sfdp path. The final SVG output would be **identical**.
- **Confidence**: High

---

## Observation: The golden comparison uses numeric tolerance (0.01pt for deterministic engines)
- **Context**: `test/golden/compare.ts:12-26` — tolerance table.
- **Finding**: Dot, circo, twopi, osage, patchwork are `deterministic` (tolerance 0.01pt). Neato, fdp, sfdp are `iterative` (tolerance 0.5pt). The self-baseline diff requirement from AD2 means: after introducing `gv_postprocess` (which does the same shift currently done by `svgBeginGraph`'s tx), the SVG group translate `tx` drops from `SVG_PAD - bb.ll.x` to `SVG_PAD - 0 = SVG_PAD`, but all node coords shift by exactly `+bb.ll.x`. Net change: zero. All coordinates in the emitted SVG are unchanged → golden diff is zero.
- **Impact**: Option A (replace the SVG-group-translate ad-hoc offset with a model-level gv_postprocess shift) is arithmetically safe for all engines. The two transformations are exactly equivalent.
- **Confidence**: High

---

## Observation: Engines that already normalize produce bb.ll = (0,0) — no double-shift risk
- **Context**: Checking patchwork/sfdp paths where `shiftOneGraph` is already called.
- **Finding**: For engines that already translate to origin (patchwork, sfdp, neato/multi-component), `g.info.bb.ll` is already `{0,0}` when `render()` is called. A `gv_postprocess` call with `Offset = bb.LL = {0,0}` would be a no-op: `translate_drawing` returns immediately when `!shift && !Rankdir` (C line 159). So no double-shift would occur for those engines.
- **Impact**: Confirms Option A is safe for all engines including those that pre-normalize.
- **Confidence**: High

---

## A vs B Recommendation

**Recommendation: Option A — faithful replacement.**

The existing TB-case normalization lives entirely in one place:

**File to modify**: `src/render/svg-graph.ts:124-127` (`svgBeginGraph`)
```typescript
// CURRENT (to be removed under Option A):
const tx = SVG_PAD - bb.ll.x;   // ← absorbs bb.ll.x offset
const ty = bb.ur.y + SVG_PAD;   // ← bb.ur.y reflects pre-shift coordinates
```

**Under Option A**: `gv_postprocess` (in `src/common/postproc.ts`) shifts all node/edge coordinates and updates `g.info.bb` so that `bb.ll = {0,0}`. After that call, `svgBeginGraph` computes `tx = SVG_PAD - 0 = SVG_PAD` and `ty = bb.ur.y + SVG_PAD` where `bb.ur.y` now equals the original height (unchanged, since shifting all coords by `-bb.ll` preserves height). The emitted SVG is arithmetically identical.

**Code to delete/bypass under Option A**:
- `src/render/svg-graph.ts:125` — the `- bb.ll.x` subtraction in `tx`. Becomes: `const tx = SVG_PAD;`
- Rationale: with gv_postprocess applied, `bb.ll.x` is always 0 at render time. The comment on line 39 (`// viewBox always starts at (0,0); group translate accounts for bb.ll offset`) also becomes stale and should be updated.

No other files need changes. The engines that already pre-normalize (patchwork, sfdp, neato) are unaffected because `gv_postprocess` is a no-op when `bb.ll = {0,0}`.

Option B (conditional application for rankdir ≠ TB) is not needed because the math is equivalent in all cases — the existing ad-hoc mechanism already handles TB exactly as `gv_postprocess`'s TB branch would.

---

## Summary for T6

| Item | Value |
|------|-------|
| Existing TB-case translation function | `svgBeginGraph` in `src/render/svg-graph.ts:116-130` |
| Exact offset math | `tx = SVG_PAD - bb.ll.x` (line 125) |
| Where bb comes from | `job.bb` set in `render()` at `src/gvc/device.ts:186` from `g.info.bb` |
| Engines flowing through it | All engines (dot, circo, twopi, osage, fdp, neato, sfdp, patchwork) |
| Engines that pre-normalize | patchwork, sfdp, neato (multi-component) — bb.ll already 0 |
| Recommendation | Option A: replace |
| Code to delete under A | Line 125: `- bb.ll.x` suffix in `tx` computation |
| Golden impact | Zero (arithmetic equivalence) |
