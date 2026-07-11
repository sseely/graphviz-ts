# RCA: ortho maze divergence under circo/twopi — TWO root causes, BOTH FIXED

Date 2026-07-11. Engines circo/twopi (also dot/osage — same subsystem). Compare
xdot @ 0.01. Targets: circo 1990/2082, twopi 2361/2183/144_ortho. All 5 now
**conformant (0 diffs)**.

Prior notes (`circo-edge-tail-rca.md`, `twopi-ortho-family-rca.md`) localized the
symptom (native "packs ~6 segments/channel where the port routes 1"; 30–58pt
track shifts; 144_ortho "duplicated ortho controls") but left it OPEN/DEFERRED.
Cell-by-cell instrumentation of BOTH sides (gvmine ORTHO_DUMP recipe) found the
maze **partition/cells/sgraph-edges byte-identical** — the divergence was two
downstream bugs in the port's faithful reimplementation.

## Method (decisive experiments)

Instrumented `lib/ortho/ortho.c` (ORTHO_DUMP-gated fprintf; reverted after) and
the port's `orthoEdges` to dump, for 1990/circo (smallest full repro):
- maze header + every non-node cell bb/flags/sides, every sgraph sedge
  (v1,v2,weight,cnt), every snode → **byte-identical** (only 3 sedges differ in
  the 4th decimal = fprintf rounding of the same double).
- per-edge route segments + the Dijkstra path (n_dad chain) + cost.

Result: routes i0–i5 identical; **i6 onward the port found HIGHER-cost paths**
(i6 port 1140 vs C 995). Dumped the full weight vector entering i6 (identical)
and the temp edges from `addNodeEdges` for i6 (identical). So port and C searched
a byte-identical graph yet Dijkstra disagreed → a `shortPath` defect.

Reconstructed the exact i6 graph from the C dump and ran a clean reference
Dijkstra offline → **1140** (the PORT's answer). So the port's Dijkstra was
CORRECT; C's 995 used an edge NOT in the dumped graph. Per-hop dump of C's path
showed `N_DAD(588)=275` but `N_EDGE(588)=(588,573)` — inconsistent: C reached the
target via a phantom/stale edge.

## Root cause #1 — shared-buffer adjacency spill (sgraph.c:initSEdges)

C allocates ONE contiguous `int` buffer `6*nnodes + 2*maxdeg` and hands each
regular snode a **fixed 6-slot region**, each dummy `maxdeg`
(`sgraph.c:initSEdges`). `addEdgeToNode` writes `adj_edge_list[n_adj++]=idx` with
**no bound check**. In 1990/circo **390 of the permanent snodes already have
n_adj==6 at construction** (fan-in topology). When `addNodeEdges` adds a temp
edge to such a node, the write lands at local index 6 = **the first slot of the
NEXT node's region** — corrupting that neighbor's adjacency. Those spilled writes
**survive `reset`** (reset restores only `n_adj`, never the buffer), so a spill
from one routed edge leaves a phantom edge index in a neighbor's slot that a
LATER edge's `shortPath` reads as a real neighbor. That is how C's node 275
"reached" dummy 588 (its slot held a stale index to temp edge (588,573);
`adjacentNode` returns v1=588). The spill lets C's Dijkstra traverse cross-cell
phantom edges → the shorter, differently-shaped routes ("6 segments in a
channel"). It is decades-old load-bearing C behavior.

The port used per-node **growable** `number[]` arrays → never spilled → always
found the true optimum → diverged.

**Fix** (`sgraph.ts:initSEdges` + `types.ts`): allocate one shared
`Int32Array(6*nnodes + 2*maxdeg)`; each node's `adjEdgeList` is
`buf.subarray(offset)` (view to buffer END), 6 per regular node, `maxdeg` per
dummy — reproducing the forward spill and its cross-`reset` persistence exactly.
`addEdgeToNode`/`createSEdge` unchanged (already index-assign at nAdj).

After the fix all 14 routes of 1990 match C bit-for-bit (path + cost). This alone
fixed 1990, 2082, 2361, 144_ortho (→0) and dropped 2183 79→24.

## Root cause #2 — chanSearch one-directional containment (ortho.c:chancmpid)

2183 residual (24 diffs, all edge a->b): routes now byte-identical to C, but
a->b's horizontal endpoint y = 36 (port) vs 54 (oracle). Instrumented `htrack`:
the port's `chanSearch` returned **null** (fallback to commCoord), C found a
channel (cell y[36,72], f=0.5 → 54). a->b's segment extent is x `[-36, 48.18]` —
it extends BEYOND its channel (segment ⊇ channel).

C's channel dict comparator `chancmpid` (ortho.c:250) treats two intervals as
equal when **one contains the other** (nested EITHER way): if `k1.p1>k2.p1` match
when `k1.p2<=k2.p2`; if `k1.p1<k2.p1` match when `k1.p2>=k2.p2`. The port's
`chanSearch` only tested `chan ⊇ seg` (`chan.p1<=seg.p1 && chan.p2>=seg.p2`),
missing the `seg ⊇ chan` case → dropped the segment → htrack fell back.

**Fix** (`maze-channels.ts:chanSearch`): port `chancmpid` verbatim and match on
`chancmpid(chan.p, seg.p) === 0`. 2183 → 0.

## Verification

- 5 targets: 1990/2082 (circo) 0; 2361/2183/144_ortho (twopi) 0.
- 144_ortho "duplicated controls [P0,P0,P1,P1]" symptom RESOLVED as a downstream
  effect: the route now matches C, so buildSpline emits C's exact ispline and
  clip_and_install fits identically (C's attachOrthoEdges builds the SAME
  duplicated-point ispline — the earlier "interpolated vs duplicated" was two
  different routes, not two fitters).
- 17 corpus `splines=ortho` ids under dot: 15 pass @0; 2538 (8) / 2620 (10)
  pre-existing, byte-identical with/without the fix (stash A/B).
- tsc clean; full suite 2934/2934.
- Regression guard, 0 regressions: partial circo sweep (444 ids: 0 regr, 1990 +
  1856 fixed) + partial twopi sweep (507 ids: 0 real regr — the lone
  pass→port-error `macosx-nestedclust_dot` is a sweep-kill artifact, verified 0
  diffs on direct rerun and has no splines=ortho) + all 17 splines=ortho ids ×
  {dot,circo,twopi,osage} stash A/B: every non-zero case (2538 8 everywhere;
  osage 1447 52 / 1447_1 1246; circo 1447/1880 timeouts) byte-identical
  with/without the fix. Fixes: 1990/2082 (circo), 2361/2183/144_ortho/144_no_ortho
  (twopi).

## Ruled out

Partition/trapezoid decomposition (cells byte-identical); sgraph weights
(identical entering i6); temp edges (identical); PQ/fPQ (faithful; reference
Dijkstra confirmed port's pre-fix result was the true optimum); edge sort order
(es[] order identical); node positions/boxes (bit-identical, pure routing).
Not ULP/A9 — deltas 18–58pt from two concrete algorithmic mis-ports.
