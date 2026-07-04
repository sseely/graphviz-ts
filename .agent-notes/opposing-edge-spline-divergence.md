# Opposing-edge (2-cycle) spline routing diverges from C — NaN's last blocker

## ⚠️ SUPERSEDED 2026-06-24 — NOT a spline/port bug; it is compress x-coord
The "offset-port" hypothesis below is DISPROVEN. Instrumented C `beginpath`:
`tail_port.p=[0,0]` — there is NO port offset. The +8 was `ND_coord(Target).x`
itself (C lays Target at x=675 pre-normalization; TS at 667). A full node-by-node
compare (TS+compress vs native, GVBINDIR oracle) shows **53/76 nodes mispositioned
in X ONLY (dy=0 for all), by −5..+1pt** — a broad `ratio=compress` x-coordinate
(x-network-simplex) divergence. The Target<->TThread over-segmented spline is just
the visible SYMPTOM: TThread sits −3pt off, which × the 0.24 corridor-entry
fraction = 0.73pt, exactly enough to flip the straight line from 0.2px inside the
tail-box wall to 0.55px outside → shortestPath bends → extra bezier. Fix the
x-positions and the spline resolves on its own. `compressGraph` (position-cluster.ts)
is a FAITHFUL port of C compress_graph; the bug is downstream in containNodes /
the compress width constraint / the x-NS solve. Mission: plans/fix-compress-xcoord.
Everything below is retained only as the (now-rejected) routing analysis.

---


## Observation: opposing edges bypass the corridor router; segment counts diverge
- **Context**: NaN reaches maxDelta 21 with compress + 2-cycle + clip fixes, but
  stays `diverged` because the `Target<->TThread` opposing 2-cycle routes splines
  with **14 bezier points vs native's 8** (a *structural* diff → diverged).
- **Isolation (minimal repro)**:
  `digraph{a->b;b->a; a->p;a->q;a->r; p->b;q->b;r->b}` (a→b spans 2 ranks past
  the p/q/r rank):
  - `a->b` **alone** (drop `b->a`): native 10 pts, port **10** — corridor
    routing is CORRECT for a single long edge.
  - `a->b` **with opposing `b->a`**: native 10 (both), port **4** (both) — the
    port collapses the opposing pair to STRAIGHT splines.
- **Root cause**: cross-rank opposing/parallel groups dispatch (splines.ts
  `dispatchEdgeGroup`→`routeParallelEdgeGroup`/`makeStraightEdges`) route via
  `dumb=[tail,tail,head,head]` + perpendicular `spreadControlPoints` — a STRAIGHT
  line, NOT the pathplan corridor route the lone edge uses (splines.ts:414 even
  notes "full pathplan-based obstacle routing … is deferred" on this path). C's
  `make_regular_edge` routes each opposing edge through the corridor and offsets.
- **Two sub-cases, both wrong**:
  1. Cross-rank opposing (repro): port UNDER-segments (4 vs 10) — straight,
     skips the corridor.
  2. Adjacent-rank crowded opposing (NaN `Target<->TThread`, far apart in x):
     port OVER-segments (final 7 pts / 14 nums vs native 4 pts / 8 nums).

## NaN's adjacent sub-case — EXACT router PINNED (2026-06-24)
- Dispatch chain: `dotSplines_` → `routeEdgeGroup` → `dispatchEdgeGroup` →
  `routeParallelEdgeGroup` (splines-route.ts) → `baseSplineForGroup` →
  **`routeRegularEdgeFaithful`** (edge-route-faithful.ts). routeParallelEdgeGroup
  computes ONE base spline then installs x-shifted copies (installShiftedEdge →
  clipAndInstall); the offset preserves the point count, so the segment count is
  set entirely by the base.
- The base spline for `Target<->TThread` IS the divergence:
  `routeRegularEdgeFaithful` returns a **7-point (2-bezier) base WITH compress**,
  but a **4-point (1-bezier) base WITHOUT compress**. Native is 4 (1 bezier) in
  both. So routeRegularEdgeFaithful OVER-segments an adjacent regular edge in the
  COMPRESS-TIGHTENED corridor.
- **Compress-dependent**: on plain main (no compress) NaN's `Target<->TThread`
  renders 4 = native 4 (matches). The 7-vs-4 only appears once ratio=compress
  packs the nodes (tighter corridor → routeRegularEdgeFaithful inserts a 2nd
  bezier). So NaN's last blocker = `routeRegularEdgeFaithful` corridor/box
  computation adding a spline segment that C's make_regular_edge does not, in
  tight corridors.
- **Fix locus narrowed to `routeRegularEdgeFaithful`** (and its box/corridor
  build): make it emit the same bezier-piece count as C's adjacent
  make_regular_edge for tight corridors. The cross-rank UNDER-segment sub-case
  (repro above) is a sibling in the same parallel/opposing path — verify both.

## MECHANISM PINNED TO SUB-PIXEL (2026-06-24, oracle-confirmed)
Instrumented C `routesplines_` (Pshortestpath output `pl`) + port `shortestPath`
output for Target->TThread, compress active, GVBINDIR=/tmp/gvplugins build dot.

- **C polyline = STRAIGHT 2-point**: `eps=[675,449][474,379] pl=675,449|474,379`
  → Proutespline force-accepts 2-pt route = 1 bezier (pn=4).
- **Port polyline = BENT 3-point**: `eps=[667,449][463,379]
  pl=667,449 | 618,432 | 463,379` → reallyRoute splits at the bend = 2 beziers
  (7 pts). The bend vertex (618,432) is the tail box's lower-left CORNER.
- **The lever is the ENDPOINT PORTS, not the boxes.** C's ports are the node
  centers shifted +8 in x (Target center 667→port 675; TThread center 466→474):
  the **opposing-edge separation is applied to the spline endpoints BEFORE
  routing**. Geometry at the tail-box bottom (y=432):
  - C straight line x=626.2 vs C tail-box wall 626 → INSIDE by 0.2 → straight.
  - Port straight line x=617.5 vs port tail-box wall 618 → OUTSIDE by 0.5 →
    shortestPath must bend around the corner → extra segment.
- So `routeRegularEdgeFaithful` computes the base from **un-offset node centers**;
  `routeParallelEdgeGroup` then x-shifts the whole curve AFTER routing
  (installShiftedEdge→clipAndInstall). Because the base is routed from centers,
  it marginally (0.5px) clips the tail-box corner and bends. C routes each
  opposing edge from its OWN offset ports, so its line clears the corner.
- **It is NOT the box geometry**: port tail box [618..] is even WIDER-left than
  C's [626..], yet the port still clips — because its endpoints sit further left
  too. Matching the boxes alone would not fix it; the endpoints are the cause.
- **FIX**: apply the per-edge opposing/parallel x-offset to the base edge's
  start/end ports BEFORE `routeRegularEdgeFaithful` (route in the offset frame,
  like C make_regular_edge per-edge), instead of routing centered then shifting
  the curve. Then the shifted copies need no separate post-offset for the base
  edge. HIGH risk: shared router; full survey + oracle goldens required.
- Repro needs compress (tight corridor). To repro standalone, pack adjacent-rank
  nodes far apart in x with flat neighbors crowding the corridor.
- **Impact**: every graph with opposing 2-cycles whose endpoints aren't trivially
  stacked. NaN's last blocker to structural-match; also affects edge *shape*
  fidelity broadly. The 2-cycle x-NS arrangement (separate fix) is already
  correct — this is purely the spline geometry.
- **Confidence**: High on the cross-rank under-segment cause (minimal repro +
  the `makeStraightEdges` straight-line construction). Medium on NaN's
  adjacent-rank over-segment sub-case (router not yet pinned).

## Scope of a fix (substantial — own mission)
- Route opposing/parallel cross-rank edges through the SAME corridor/fitter the
  lone edge uses (the port's regular-edge router), then apply the perpendicular
  offset — instead of `makeStraightEdges`' straight `dumb` points. Mirror C
  `make_regular_edge` (dotsplines.c:1880+) which routes each then separates.
- First pin NaN's adjacent-rank sub-case router (instrument the dispatch for
  `Target<->TThread`).
- **Risk: high.** Touches the parallel/opposing spline router shared by every
  multi-edge/2-cycle graph; many graphs currently conformant through it (the
  straight route happens to match C when endpoints are stacked / no obstacles).
  Full survey + oracle goldens mandatory; expect both fixes and regressions to
  surface until the corridor route matches C across sub-cases.
- Build oracle: `GVBINDIR=/tmp/gvplugins build/cmd/dot/dot`.
