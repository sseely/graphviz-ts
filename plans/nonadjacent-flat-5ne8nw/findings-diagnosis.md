# Pre-mission diagnosis — 5:ne->8:nw non-adjacent flat (de-risk pass)

Performed before scoping, on `main` (after #241_0 curl/arrow fixes landed,
merge 3106329). All evidence below is REPRODUCED, not assumed.

## TL;DR (the proven root finding)
`5:ne->8:nw` is a **non-adjacent flat edge** routed by
`routeFlatEdgeFaithful` (`splines-flat.ts`) → `routeSplines`
(`splines-routespl.ts`). Its box channel **conforms to C `make_flat_edge`
modulo a uniform +27 internal x-translation** (the benign frame offset already
documented in memory `flat-edge-241-is-y-only`). **Yet the port's spline is an
EXACT MIRROR of C's** (same endpoints, control sequence reversed, knot on the
head side instead of the tail side). Because the box channel + endpoints are
identical up to a *uniform translation*, and a shortest-path-funnel + bezier-fit
is translation-invariant, a faithful port MUST be translation-equivariant. The
port is not → the bug is inside `routeSplines` (or a sub-step:
`buildPolyPoints` / `shortestPath` / `routeSpline` / `buildConstraintVectors` /
`limitBoxes`), almost certainly an **absolute-coordinate dependence** that breaks
equivariance. **This is independently unit-testable without a full graph layout.**

## The graph (241_0.dot, nodes 5,6,7,8 same rank)
All node positions in the port **conformant** the oracle. Row at internal y=18
(svg y=-25.88). Nodes: 5@x387, 6@x459, 7@x531, 8@x603 (rw=27). The edge
`5:ne->8:nw` bows over nodes 6,7. `nodesep=18`.

## Final SVG splines (port vs native dot 15.1.0)
```
port:   d="M402.02,-41.9 C 451.44,-91.32 491.11,-82.13 558,-61.88
                          569.02,-58.55 573.84,-55.53 579.88,-49.89"
oracle: d="M402.02,-41.9 C 413.34,-53.22 416.67,-57.24 432,-61.88
                          495.11,-80.98 533.98,-90.24 579.67,-49.74"
```
Endpoints match (402.02,-41.9 start; ~579 end). The two-bezier **join** is at
y=-61.88 in both, but **x=558 (port, head-side) vs x=432 (oracle, tail-side)** —
that is the entire `maxDelta 126` (558-432=126) and the residual 0.35pt bbox-top
shift. This is the ONLY path-level diff in the whole 241_0 SVG.

## Box channels (instrumented C vs probed port; internal y-up coords)
C `make_flat_edge` (rebuilt `gvplugin_dot_layout`→/tmp/gvplugins, then restored):
`cnt=1 i=0 stepx=9 stepy=18 vspace=36 Multisep=18`
```
tend[0]=[324,0,396,36]  mid0=[324,36,405,54]  mid1=[324,54,612,72]
mid2=[531,36,612,54]    hend[0]=[540,0,612,36]
C SPLINE: (375,34)(386.3,45.3)(389.7,49.4)(405,54)(471.9,74.2)(511.6,83.4)(561,34)
```
Port `routeFlatEdgeFaithful` (probe, reverted): `side=4(TOP) stepx=9 stepy=18`
```
tend=[351,0,423,36]  mid0=[351,36,432,54]  mid1=[351,54,639,72]
mid2=[558,36,639,54]  hend=[567,0,639,36]
port SPLINE: (402,34)(451.4,83.4)(491.1,74.2)(558,54)(573.3,49.4)(576.7,45.3)(588,34)
```
**Every box is port = C + (27,0). Uniform. No y diff, no order diff.** (Verified
field-by-field; `topBoxes` source already matches C `boxes[0..2]` exactly, and
`stepx=stepy` match because `Multisep == nodesep` and cnt=1 makes `/(cnt+1)=/2`.)

## The mirror (port spline in C's frame, i.e. minus 27 in x)
| pt | C | port−27 |
|----|---|---------|
| 0 (start) | (375,34) | (375,34) |
| 1 | (386.3,**45.3**) | (424.4,**83.4**) |
| 2 | (389.7,**49.4**) | (464.1,**74.2**) |
| 3 (knot) | (**405**,54) | (**531**,54) |
| 4 | (471.9,**74.2**) | (546.3,**49.4**) |
| 5 | (511.6,**83.4**) | (549.7,**45.3**) |
| 6 (end) | (561,34) | (561,34) |

Control-y sequence: C `[34,45.3,49.4,54,74.2,83.4,34]`; port `[34,83.4,74.2,54,
49.4,45.3,34]` = **C reversed**. Knot at C `405` (21% from tail) vs port `531`
(79% from tail). A clean tail↔head mirror.

## Port code path (where the fix lives)
`edge-route.ts:routeForwardEdge → hasSidePort → routeFaithfulSidePort` →
(sameRank, NOT adjacent) → `splines-flat.ts:routeFlatEdgeFaithful` →
`routeSplines(P)` (`splines-routespl.ts:415 → routeSplinesInternal:342`):
`checkPath → (flip if boxes[0].ll.y>boxes[1].ll.y; here false) → buildPolyPoints
→ shortestPath(poly,eps) → routeSpline(edges,pl,evs) → limitBoxes`.
The mirror originates in one of: `buildPolyPoints` (polygon orientation),
`shortestPath` (funnel polyline), `routeSpline` (Proutespline bezier fit), or
`buildConstraintVectors`/`limitBoxes` (absolute-coord dependence). Batch 1 pins
which by dumping the intermediate `pl` (polyline) and comparing to C
`Pshortestpath`.

## C reference
`~/git/graphviz/lib/dotgen/dotsplines.c:make_flat_edge` (1502; box build
1567-1598, `stepx=Multisep/(cnt+1)`, `Multisep=GD_nodesep`).
`~/git/graphviz/lib/common/routespl.c:routesplines_` (294): `checkpath` →
`Pshortestpath` → `Proutespline`. Port mirror in `src/pathplan/` (shortestPath,
routeSpline) + `src/common/splines-routespl.ts`.

## Latent secondary bug (note, not this edge)
Port `routeFlatEdgeFaithful` hardcodes `stepx=nodesep/2`, `stepy=vspace/2`; C uses
`/(cnt+1)`. Identical only for cnt=1. A cnt≥2 non-adjacent multi-flat would
diverge. `5:ne->8:nw` is cnt=1, so out of scope here, but the fix should use
`/(cnt+1)` if it touches that line.

## Oracle integrity (AD-5)
C tree restored clean (`git -C ~/git/graphviz status` shows no modified source);
`gvplugin_dot_layout` rebuilt clean into /tmp/gvplugins; instrumented run left no
CPROBE markers. Oracle remains native ground truth.
