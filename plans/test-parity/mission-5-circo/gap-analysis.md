# Mission 5 — circo gap analysis (T1 recon, 2026-06-10)

Baseline at mission start: 997 passed / 25 failed (matches
baseline-after-m4.md). 6 circo goldens + the equal-radius unit test.

## Root causes

1. **Unit confusion (the height family).** C circogen works entirely
   in INCHES: `largest_nodesize` reads ND_width/ND_height (0.75/0.5),
   mindist defaults to 1.0in, radius = N(min_dist+largest)/2π inches,
   ND_pos is inches; spline_edges converts ×72 to coord. Our port:
   largestNodesize reads lw/rw/ht (POINTS), and copyPositions writes
   inch-space pos directly into points-space coord. circo-simple
   verification: C radius = 6(1+0.75)/2π = 1.671in = 120.3pt (matches
   ref node ring exactly); ours = 6(1+36)/2π = 35.3 "points".
2. **Pipeline truncated.** C circo_layout: setEdgeType(LINE) →
   circoLayout → spline_edges → dotneato_postprocess. Ours never sets
   the edge type (no edge paths — hidden behind the height diff),
   skips spline routing, and substitutes normalizeGraphBB. Mission 4's
   splineEdgesShifted is the drop-in for the C wrapper.
3. **Component packing mode**: C uses getPackInfo(g, l_node,
   CL_OFFSET); ours hardcodes Graph mode (pre-M4 there was no
   polyomino packer). buildProxyGraph must also feed coords in points.
4. **record sizing**: C record_init sets ND_width/ND_height
   (PS2INCH of the field-tree size); our recordInit leaves the
   neato defaults (0.75/0.5), which would starve largest_nodesize
   for circo-record.
5. circogen is byte-identical 15.0.0..HEAD except the
   find_longest_path null-guard (15.0.0 form already noted in
   overview.md); our port must keep the guard.

Positioning code (circpos/blocktree) touches no node sizes in either
language — fixing the radius units propagates everywhere.

## Tasks

- T2: units + pipeline (largestNodesize inches; copyPositions stops
  faking coords; setEdgeType LINE; splineEdgesShifted; l_node packing
  with points coords in proxies; recordInit width/height).
- T3: chase residuals per test (equal-radius unit test, html/record
  variants), re-baseline, merge.
