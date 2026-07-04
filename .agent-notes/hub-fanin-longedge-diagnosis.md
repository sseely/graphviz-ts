# hub-fanin long-edge (b100) — DIAGNOSED: accepted hypot-ULP tie-break class

## Verdict
b100's `Node23730->Node23729` Δ20 spline divergence is **root-caused and proven
irreducible** — the SAME accepted class as the 2368 residual
(`.agent-notes/2368-residual-flat-label-ranksep.md`), NOT the b15
chain-fragmentation mechanism. Confirmed in an isolated worktree with paired
C/port instrumentation (worktree discarded; C repo reverted + rebuilt clean).

## Mechanism
`Proutespline`'s `findMaxDev` (`src/pathplan/route.ts:182-212`) picks which
interior point of a 4-point taut-string polyline becomes the single bezier knot.
For this edge the channel is an EXACT geometric mirror tie about y=626: the two
candidate deviations are `d1=35.070361810494532` vs `d2=35.070361810498156` — a
~3.6e-12 (~1 ULP) difference.
- **C** (`lib/pathplan/route.c:reallyroutespline`, bare `if (d > maxd)`): Apple
  libm/hypot noise makes `d2` win -> knot at `inps[2]=(17477,616)`.
- **Port** (`route.ts:209`, deliberate translation-equivariant tolerant
  tie-break `d > maxd*(1+1e-10)+1e-10`): on an exact tie keeps the FIRST index ->
  knot at `inps[1]=(17477,636)`.
Delta 20 = 636 vs 616 = exactly one rank-row height.

## Origin
`src/pathplan/route.ts:209` (tolerant tie-break) vs C `lib/pathplan/route.c`
(strict `d > maxd`).

## Paired evidence (C-internal y-up coords)
- C path:   `(17442,681)(17442,681)(17487.65,647.03)(17477,616)(17468.78,592.03)(17442,571)(17442,571)`
- Port path:`(17442,681)(17442,681)(17468.78,659.97)(17477,636)(17487.65,604.97)(17442,571)(17442,571)`
- First divergence: control-point index 3 (the shared knot), y=616 (C) vs 636 (port).
- Everything upstream is BYTE-IDENTICAL: `maximalBbox`/`rankBox` (all 3 boxes +
  both end-boxes), the corridor polygon `poly.ps` (20 pts), and the taut path
  `pl.ps` (4 pts) all match C exactly.

## Ruled out
- **b15 groupSize/getMainEdge chain-fragmentation ("long-edge doubling")** —
  REFUTED for b100: `chainSegments` returns exactly 2 segments, no smode split,
  no dispatch fragmentation; all structures match C up to `Proutespline`.
- Node/virtual-node geometry, polygon/taut-path construction — all byte-identical.

## Fix: NONE (accepted, irreducible)
Reverting to C's strict non-portable tie-break was already exhaustively tested
(see the 2368 note): net wash across the ~790-graph survey AND regresses two
oracle-pinned unit tests (`splines-routespl` #241_0 translation-equivariance,
`splines-flat-multi` cnt=3). Chasing Apple's non-portable libm ULP would abandon
translation-equivariance for zero net gain. -> Accept b100/b104 as A3, same as 2368.

## Still OPEN (not this mechanism)
b29 (x4) / b124 (x3) have Delta up to 2559 — orders of magnitude larger than one
rank-row (20). NOT investigated here (scoped to b100). Their magnitude is
inconsistent with a single knot tie-break, so they are a DIFFERENT, larger
mechanism — remain tracked/open (possibly the real b15 class).
