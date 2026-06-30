<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: honda edge-spline divergence was unparsed samehead/sametail

- **Context**: Mission plans/honda-edge-spline. After the x-coord NS fix
  (fc7b8f7) honda-tokoro stayed "diverged" (maxΔ ~27.9): 2 of 40 edge paths
  differed in bezier PIECE COUNT (edge2 `n002->n001` native 2 / port 1; edge25
  `n023->n015` native 2 / port 4), plus coord deltas on labeled edges. The
  mission README framed it as a labeled-edge / fitter piece-count class.
- **Finding (4-stage GV_XDUMP vs __XDUMP oracle, routespl.c/dotsplines.c vs
  splines-routespl.ts/edge-route-chain.ts)**: First divergence was STAGE2 (box
  corridor). For edge2 `maximal_bbox` was IDENTICAL C↔port — the divergence was
  the path ENDPOINT (C ended above n001 center, port at center). The
  discriminator across edges: the divergent ones carry `samehead=`. **Root
  cause: `samehead`/`sametail` edge attributes were never read into `e.info`**,
  so the (already ported + wired at index.ts:127) `dotSameports` never fired —
  `graphHasSamehead()` was always false. C merges same-`samehead` edges onto a
  shared head port (above/beside center); the port routed each to the node
  center. ADR-1's "intermediate label-rank vnode" premise was WRONG — these are
  headlabels, not mid-edge labels; no label rank is inserted.
- **Fix (commit 58cc5cd), four faithful parts**:
  1. `init.ts` dotInitEdge: parse `samehead`/`sametail` (C `agxget E_samehead`,
     empty string ⇒ no group). THIS is the root-cause fix.
  2. `sameport.ts` shapeClip: the boundary clip was a rectangle STUB, wrong for
     ellipse heads (every honda head). Replaced with the shape-faithful
     `bezierClipNode` + `nodeInsideFn(nodeBoxOf(u, u.root))` (C `shape_clip` /
     `shape_clip0`). Fixed the ~17px shared-port shift.
  3. `splines-route.ts` routeParallelEdgeGroup: base spline now uses the first
     group member with a defined port (C `ea = port-defined ? e0 : main`), so a
     plain parallel sibling of a samehead edge fans around the shared port
     instead of the node center.
  4. `splines.ts` groupSize: split cross-rank parallels whose head/tail ports
     differ (C portcmp, dotsplines.c:373-376) so two parallels carrying distinct
     samehead/sametail ports each route their own base.
- **Impact**: honda diverged→**structural-match** (maxΔ 27.9→1.06, 18→2
  divergent edges, 0 piece-count diffs; target edges edge2/edge25 conformant).
  Survey **0 regressions on both baselines**; the same fix took the **arrows
  family to conformant** (graphs-arrows/newarrows + linux/macosx/nshare/share/
  windows variants) and improved 2193/NaN/b102/b143/ports/xx. 2424 tests green.
- **Residual (sub-pixel, accepted — keeps honda at structural-match, ~1px on 2
  edges)**: n012→n011 (two parallels carrying DISTINCT samehead ids m005/m006).
  Investigated to ground truth (GV_XDUMP in `sameport`/`clip_and_install`/
  `make_regular_edge` vs `buildSharedPort`/`clipAndInstall`/`routeRegularEdge-
  Faithful`):
  - **NOT the shared port** — `buildSharedPort` is conformant to C
    `sameport`: same average dir, same `y1` (14.977842 / 15.021354), same
    `round` → `p=(-1,15)` / `(0,15)`. (Disproves the earlier "round(y1) tie in
    the shared-port clip" guess.)
  - **NOT the grouping** — disabling the `groupSize` portcmp split changes
    nothing; both parallel instances still land 1px off.
  - **Root = `maximal_bbox` head-corridor box wall.** C installs both n012→n011
    at internal x=90; the port at x=89 (→ the 1px SVG-y shift). The head
    endpoint is clamped −1 by the n011 corridor box wall, independent of `hp`.
    This is the documented box-wall `round()` sub-pixel class
    [[bbox-class-control-hull-vs-curve]] — the port already mirrors C's
    `maximal_bbox` formula exactly; the delta is a floating-point rounding
    boundary, not a logic gap.
  - **Decision: leave as-is.** A fix would need to alter `round()` in
    `maximal_bbox`, a primitive shared by every corpus edge — corpus-wide
    regression risk for 1px on 2 edges. If ever pursued, it is its own gated
    mission (instrument the n011 head box-wall inputs in both, find the exact
    round-tie, validate any tweak against the FULL survey on both baselines).
- **Confidence**: High (root cause proven by toggling the attr parse: piece-
  count diffs 2→0, maxΔ 27.9→17.4 with parse alone; 0 corpus regressions; the
  residual localization is oracle-confirmed, not hypothesized).

## Gotcha: shape_clip is shape-aware; the rect stub silently mis-clips ellipses

`sameport.ts` originally approximated the node boundary with a rectangle.
Box nodes were fine; every ellipse head got a shared port a few px off. When a
shared/merged port lands "near but not on" a node, suspect the boundary clip
primitive, not the direction/averaging. Reuse `nodeBoxOf` + `bezierClipNode` +
`nodeInsideFn` (the proven edge-clip path) rather than re-deriving geometry.
