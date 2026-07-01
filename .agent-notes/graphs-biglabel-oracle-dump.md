# graphs-biglabel — oracle/port ground-truth dump (T1 + early T2)

## Symptom (from committed SVGs, headless oracle)
- Edge `struct1:f2 → struct3:here` (`g[1]/g[5]/path[1]/@d`), maxDelta 111.03.
- ORACLE path: 2 cubics (7 pts)
  `M316.38,-1413.8 C316.38,-1365.17 499.92,-1414.13 532.25,-1377.8 602.03,-1299.39 592.03,-1005.23 578.8,-827.7`
- PORT path: 1 cubic (4 pts)
  `M316.38,-1413.8 C316.38,-1129.09 491.14,-814.12 548.19,-718.89`
- **Start point identical**; **end point differs**: oracle `(578.8,-827.7)`
  (enters the `here`/`d` cell from its RIGHT edge, x≈577.46), port
  `(548.19,-718.89)` (enters from the LEFT, x≈554.46). Δend ≈ 111pt → this
  drives maxDelta.

## Record layout is IDENTICAL (ruled out)
- struct3 node group `g[4]` is **byte-identical** port vs oracle (13897 B).
- `here`/`d` cell box (from identical geometry): x∈[554.46,577.46],
  y∈[-918.5,-459.7]; center ≈ (565.96,-688.7) = the `d` text position.

## Head-port resolution is IDENTICAL (ruled out)
- Port instrumentation (`record-port.ts`, temp): `here` →
  `sides=0`, `b=ll(185.855,-229.2)/ur(208.855,229.6)` (node-local),
  `side=0`, `p=(197.355,0.2)` (= cell center, node-local),
  `defined=true, clip=true, constrained=false`.
- `p` absolute = ND_coord(struct3)+p ≈ (565.96,-688.7) = `d` cell center. Correct.
- TS `posReclbl`/`recSideMask` (record.ts:317-341) is a faithful, exact port of
  C `pos_reclbl` (shapes.c:3589). `sides=0` for the interior `d` cell is
  correct on both sides.

## Therefore
The divergence is NOT record sizing, NOT head-port resolution. Node positions +
tail/head ports are provably identical, so the **box corridor / endpath clip /
Proutespline routing** is the origin. Port approaches `here` from the LEFT;
oracle from the RIGHT. Next: dump the port's route boxes + Proutespline input
polyline for this edge and compare to C endpath/beginpath (dotsplines.c).

## Tail port (to capture next)
struct1:f2 — start point matches, so tail resolution likely identical; confirm.

## C-oracle ground truth (instrumented dotsplines.c make_regular_edge, /tmp/ghl)
start=(45.769,1413.800) side=0 clip=0 cons=1
end=(295.355,689.100) side=0 clip=0 cons=0
nbox=3
  box[0]=(45.769,1413.800)-(45.769,1450.800)
  box[1]=(45.769,1377.800)-(261.642,1413.800)
  box[2]=(261.642,0.000)-(317.671,1377.800)
ps (7): (45.769,1413.800)(45.769,1365.166)(229.309,1414.131)(261.642,1377.800)
        (363.508,1263.336)(295.355,689.100)(295.355,689.100)

## Port ground truth (instrumented edge-route-faithful.ts routeRegularEdgeFaithful)
start=(45.769,1413.800) side=0 clip=1 cons=1
end=(295.355,690.100) side=0 clip=1 cons=0
nbox=3
  box[0]=(45.769,1413.800)-(45.769,1450.800)   # == C
  box[1]=(45.769,1377.800)-(46.583,1413.800)   # C ur.x=261.642 (port 46.583)  <-- DIVERGES
  box[2]=(48.949,689.100)-(295.355,1377.800)   # C=(261.642,0)-(317.671,1377.8) <-- DIVERGES
  spline: 1 cubic (45.769,1413.8)->(295.355,690.1)

## First divergence
Boxes 1 & 2. C box1 is WIDE (ur.x=261.642) and box2 is a NARROW vertical channel
(x[261.642,317.671], full height y[0,1377.8]) hugging the head-port column;
port box1 is thin and box2 is wide+short. => C spline goes right-along-top then
straight down (2 cubics, the up/over/down shape); port cuts diagonally (1 cubic).
start/end points match (end y off by 1.0). clip flag differs (C=0, port=1) but is
downstream of the box divergence. Origin: completeRegularPath / endPath box
x-extent + y-extent (box2 reaches y=0 in C, y=689 in port).
