<!-- SPDX-License-Identifier: EPL-2.0 -->

# cround consolidation

## Observation: C's two rounding spellings BOTH break ties away from zero
- **Context**: Consolidating five private half-away-from-zero helpers into one
  shared `cround` (`src/common/arith.ts`) and auditing every `Math.round` in
  `src/`.
- **Finding**: C reaches this deviation by two different spellings, and they
  agree. libm `round()` is half-away-from-zero (C99 7.12.9.6). The `ROUND`
  macro — `((f>=0)?(int)(f + .5):(int)(f - .5))`, `lib/common/arith.h:48` — is
  also half-away-from-zero, because the truncating cast is applied to `f±0.5`.
  `POINTS(a_inches)` (`lib/common/geom.h:62`) expands to `ROUND`. So a port site
  mirroring `round()`, `ROUND()` **or** `POINTS()` all map to the same `cround`.
- **Impact**: When auditing a rounding site, grepping the C for `round(` alone
  misses the `ROUND`/`POINTS` sites. Check all three spellings.
- **Confidence**: High (read the macro definitions).

## Observation: not every C rounding is round() — three distinct rules coexist
- **Context**: Deciding which `Math.round` call sites to convert.
- **Finding**: Three different rounding rules appear in the C, and only the
  first is `cround`:
  1. `round()` / `ROUND()` / `POINTS()` — half away from zero.
  2. printf `%.0f` — round-half-to-**even** (banker's). C's imagemap plugin
     emits every coordinate this way (`plugin/core/gvrender_core_map.c:44`).
  3. `(unsigned char)(R * 255)` — **truncation**. C converts colour channels to
     bytes this way (`lib/common/colxlate.c:292-295`).
  A blanket `Math.round` → `cround` replacement would have silently mis-modelled
  (2) and (3).
- **Impact**: The port's `src/render/map.ts` and colour-to-byte helpers
  (`color-resolve.ts`, `svg-gradient.ts`, `dot.ts:chanByte`) currently use
  `Math.round`, which matches NEITHER (2) nor (3). These are separate, still-open
  faithfulness questions — not `cround` sites. Left as-is deliberately.
- **Confidence**: High (read the C).

## Observation: `limitBoxes` num_div is a double in C, rounded in the port
- **Context**: Auditing `src/common/splines-routespl.ts:212`.
- **Finding**: The port computes `const numDiv = Math.round(delta * boxn)`.
  C does NOT round: `const double num_div = delta * (double)boxn;`
  (`lib/common/routespl.c:242`). C then loops `for (double si = 0; si <= num_div;
  si++)` and samples at `t = si / num_div` — using the *fractional* num_div as the
  divisor, so every sample parameter `t` differs from the port's.
- **Impact**: A real, independent divergence in spline box-limiting — unrelated
  to the tie-breaking issue and NOT fixed here (changing it perturbs routing
  everywhere and needs its own sweep). Worth its own investigation.
- **Confidence**: High (read both sides).

## Observation: pack.c:435's round() is unreachable — osage origin-anchors every box
- **Context**: Trying to build a real repro for the `fits()` LL rounding miss
  (`poly-pack.ts`), where the audit predicted center-origin engines would supply
  a negative half-integer `bb.ll`.
- **Finding**: `poly-pack.ts:fits()` (C `pack.c:435`) is reached only via
  `polyRects` ← `putRects`, and **osage is the only caller** of `putRects` in
  both C (`lib/osage/osageinit.c:135`) and the port. Every box osage passes is
  origin-anchored: node boxes are built as `{.UR = {xsize, ysize}}` with `.LL`
  zero-initialised (`osageinit.c:124`), and cluster boxes are translated so the
  parent's `rootbb.LL` is the origin (`osageinit.c:196`, comment: *"Translate so
  that rootbb.LL is origin"*). Instrumenting `fits()` confirmed `bb.ll === (0,0)`
  on **every** call across nested clusters, odd half-point node sizes, and 12
  corpus cluster graphs. The neato/circo/twopi/sfdp pack path does not go through
  here at all — it goes through `poly-place.ts:polyGraphs`, which already used
  `cround`.
- **Impact**: That site is a genuine C-faithfulness defect but is **latent**: no
  current entry point can feed it a tie. Do not spend time hunting a repro for it
  again. It matters only if `packRects`/`putRects` is ever called with
  caller-supplied boxes.
- **Confidence**: High (instrumented; C read).

## Observation: exact .5 ties are measure-zero on spline-derived quantities
- **Context**: Trying to build a repro for the compound-edge clipping miss
  (`compound.c:41` — a slope-scaled delta).
- **Finding**: Instrumented the four `boxIntersectf` side helpers. Over the 15
  `lhead`/`ltail` corpus graphs plus a 560-variant parametric sweep (node width,
  height, ranksep, nodesep), **1404** rounding calls produced **zero** exact-half
  ties. The rounded quantity is a ratio of spline-control-point differences
  (doubles), not of integer node coordinates, so an exact `.5` is essentially
  measure-zero there.
- **Impact**: Rounding-mode fixes on spline-derived quantities are C-faithful but
  usually output-neutral; do not expect a corpus verdict to move. The sites where
  this deviation demonstrably DID bite (the five pre-existing private copies) all
  round quantities derived from *integer* coordinates or *grid* indices. When
  hunting a live tie, look for integer-derived arithmetic (`/2`, `cval`), not
  spline geometry.
- **Confidence**: High (instrumented, 1404 samples).

## Observation: zsh does not word-split unquoted parameter expansion
- **Context**: A corpus trace loop reported "0 hits" and was believed.
- **Finding**: `FILES=$(grep -rl ...)` then `for f in $FILES` runs the loop
  **once** with the entire newline-joined blob as a single filename (zsh, unlike
  bash, does not field-split unquoted parameter expansion). `readFileSync` then
  fails inside the try/catch, the trace records zero calls, and the loop prints a
  single plausible-looking line. `for f in $(cmd)` *does* split.
- **Impact**: A whole instrumentation run silently produced a vacuous "no hits"
  result. Always assert the instrumentation FIRES (non-zero call count) before
  trusting a negative result — same class as the "zero-byte render + zip() =
  vacuous 0-diff" hazard. Use `while IFS= read -r f; do ... done < file`.
- **Confidence**: High (reproduced both behaviours).
