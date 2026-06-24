<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions — ratio=compress

## ADR-1: Compress-only scope; do not activate fill/expand/value/auto
- **Context:** populating `g.info.drawing` faithfully (`setRatio` for all kinds)
  also activates `setAspect` for the 5 `ratio=fill` graphs. `b22` (fill) is
  currently **byte-match** without fill applied; activating fill risks
  regressing it, and `jsort`/`pgram`/`trapeziumlr` (diverged) would change too.
  This is the separate, deliberately-deferred "ratio-aspect-layout" mission
  (see the `device.ts:466` note).
- **Decision:** T1 populates `drawing` **only when `ratio=compress`**. For
  `fill`/`expand`/`value`/`auto`, `drawing` stays `undefined` → `setAspect` and
  `compressGraph` both stay dead → the 6 non-compress `ratio=` graphs are
  byte-stable by construction.
- **Consequences:** NaN fixed with zero blast radius on other `ratio=` graphs.
  `setRatio` is only partially ported (compress branch); Batch 2 extends it.

## ADR-2: Populate `drawing` in `dotGraphInit`, reuse `parseDrawingSize`
- **Context:** C parses `ratio`/`size` in `graph_init` (input.c), right after
  `nodesep`/`ranksep` — which the port already mirrors in `dotGraphInit`.
  `viewport.ts:parseDrawingSize` already converts `size="x,y"` → points + filled
  flag (the `getdoubles2ptf` port used by the viewport zoom).
- **Decision:** set `g.info.drawing` in `dotGraphInit` after `parseSepAttrs`,
  using `parseDrawingSize(g.attrs.get('size'))` for the size; add a small
  `parseRatioKind` mirroring `setRatio`. Keep `size` in **points** (compressGraph
  reads `p.x`/`p.y` directly as the ln→rn minlen).
- **Consequences:** consistent with the existing graph_init port; no duplicate
  size parser; faithful order.

## ADR-3: NaN residual may remain at structural-match (accepted-delta class)
- **Context:** the probe left NaN at width 396 vs native 397 and translate -2011
  vs -2003 — a sub-pixel/low-single-digit residual after compression is correct.
- **Decision:** if that residual matches the proc3d-class x-NS/font-metric delta
  (`docs/known-divergences.md` A2), accept structural-match; do not chase it in
  this mission. byte-match is the goal but not the bar — a large maxDelta drop
  from 1907 with 0 regressions is success.
- **Consequences:** mission completes on a big, correct improvement even if the
  last point is the known text-metric floor.

## ADR-4: Batch 2 is a captured inventory, not a work order
- **Context:** the user asked to capture the dead ratio machinery as tasks so it
  is tracked, not implemented now.
- **Decision:** Batch 2 (fill/expand/value/auto) is documented with C refs,
  current dead-state, and per-task risk, and marked **DEFERRED**. It is not
  executed in this mission and each task needs its own sign-off + oracle pass.
- **Consequences:** the full ratio-aspect family is visible and scheduled
  without expanding this mission's blast radius.
