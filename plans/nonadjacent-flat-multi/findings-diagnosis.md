# Pre-mission diagnosis — non-adjacent flat cnt≥2 (oracle-validated)

Performed at the close of `nonadjacent-flat-5ne8nw`, on `main`. All evidence is
REPRODUCED, not assumed.

## TL;DR
For cnt≥2 non-adjacent flat edges between a same-rank node pair, C nests the splines
(`(i+1)·Multisep/(cnt+1)`); the port routes each edge independently at `nodesep/2`,
producing IDENTICAL overlapping splines. cnt=1 already byte-matches (it reduces to
the current code). ZERO corpus inputs trigger cnt≥2 — validated only synthetically.

## The divergence (oracle-confirmed)
Synthetic: `digraph { nodesep=0.25; {rank=same; a;b;c} a->b->c[style=invis];
a:ne->c:nw; a:ne->c:nw; }`
```
native dot (oracle) — TWO DISTINCT nested splines:
  d="M42.02,-34.02C51.57,-43.57 55.88,-44.8 69,-48 103.18,-56.33 123.81,-60.75 147.72,-41.49"
  d="M42.02,-34.02C55.21,-47.21 57.37,-53.89 75,-60 95.16,-66.99 102.84,-66.99 123,-60 136.5,-55.32 140.93,-50.31 148.18,-42.3"
port — TWO IDENTICAL splines:
  d="M42.02,-34.02C75.03,-67.03 113.59,-69.61 147.48,-41.76"
  d="M42.02,-34.02C75.03,-67.03 113.59,-69.61 147.48,-41.76"
```

## C structure (the faithful target)
`make_flat_edge` (dotsplines.c:1502, top branch) — and `make_flat_bottom_edges`
(1418, bottom branch, fired when `(tside==BOTTOM && hside!=TOP) || (hside==BOTTOM &&
tside!=TOP)`) — share this loop:
```c
stepx = Multisep / (cnt + 1);   // Multisep = GD_nodesep
stepy = vspace  / (cnt + 1);
makeFlatEnd(tail);  makeFlatEnd(head);     // ONE shared pair of end boxes
for (i = 0; i < cnt; i++) {
  e = edges[i];
  // box0 (off tail end):  UR.x = b.UR.x + (i+1)*stepx;  UR.y = b.UR.y + (i+1)*stepy
  // box1 (middle):        UR.y = LL.y + stepy            // <-- plain stepy, NOT (i+1)
  // box2 (off head end):  LL.x = b.LL.x - (i+1)*stepx
  assemble(tend + 3 boxes + hend-reversed); route; clip_and_install(e); P.nbox = 0;
}
```
Bottom branch mirrors downward (LL.y = b.LL.y - (i+1)*stepy, etc.).

`dot_splines_` (343-411) collects the group: consecutive edges sharing the same
mainedge endpoints, matching tail/head ports (`portcmp`), same label-ness → cnt; the
lead edge is forward-normalized (`makefwdedge`) so offsets nest left→right.

## Port structure (the gap)
`edge-route.ts:routeFaithfulSidePort` (≈331): for a same-rank non-adjacent side-port
flat, calls `routeFlatEdgeFaithful(g, e)` PER EDGE. That function
(`splines-flat.ts`) uses `stepx = nodesep/2`, `stepy = vspace/2`, builds ONE set of
`topBoxes`/`bottomBoxes` (no cnt, no (i+1)), routes one edge. No grouping → every
edge of a cnt≥2 group gets the SAME channel → identical splines.

`topBoxes(tlast,hlast,stepx,stepy)` and `bottomBoxes(...)` already match C's boxes
for cnt=1 (verified field-by-field in the 5:ne->8:nw diagnosis). For cnt≥2 they need
the END offset `(i+1)·step` while the MIDDLE keeps plain `stepy` — i.e. separate
end-step vs mid-step parameters.

## Corpus scan (instrumented C, FLATPROBE in make_flat_edge)
Across all 805 corpus inputs: 74 non-adjacent flat edges reach the box-channel
branches, and **every one is cnt=1**. ZERO cnt≥2. So: (a) no real graph diverges
today; (b) the fix is validated synthetically; (c) the regression bar is "the 74
cnt=1 cases stay byte-identical" (cnt-loop with cnt=1, i=0 is the current code).

## cnt=1 reduction (the safety proof)
cnt=1 ⇒ `stepx = Multisep/2 = nodesep/2` (current), `(i+1) = 1` ⇒ end offset = `step`
(current), middle = `stepy` (current). So the generalized cnt-loop with cnt=1 is
byte-for-byte the existing single-route path. Any cnt=1 golden flip means the
refactor introduced a bug, not a faithful change → STOP.
