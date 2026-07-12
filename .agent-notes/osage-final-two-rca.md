# osage final-two RCA — graphs-b106 (FIXED) + 1447_1 (in-progress)

Date 2026-07-11. Oracle = `~/git/graphviz/build/cmd/dot/dot -Kosage -Txdot`,
`GVBINDIR=/tmp/ghl`.

---

## graphs-b106 (+ linux.i386/share/windows siblings) — **FIXED**

51 xdot diffs (all edge-label `_ldraw_` T positions) -> **0 (conformant)** on
all four b106 siblings.

### First structural divergence
The prior agent chased this into the R-tree ("cover violation", obj41 missed by
rTreeSearch) and (correctly) proved every R-tree primitive faithful. That was a
downstream **symptom**. Instrumenting the R-tree insertion order (`xlspdxload`)
on both sides showed the inserted rect list is byte-identical **until INS #25**:

```
PORT INS 25 key=51756 rect=[20,192,125,212]
C    INS 25 key=51757 rect=[21,192,125,212]
```

The inserted **rect itself** differs (x0=20 vs 21), which also flips the Hilbert
key -> different tree topology -> the cover violation is emergent, not a
primitive bug.

### Root cause (mechanism)
`objplpmks` computes `rect.x0 = floor(objp.pos.x - lbl.sz.x)`. For Node1398
(size 103.27x20, no label so lsz=0):
- C:    `pos.x = 21`                     -> floor(21)      = 21
- PORT: `pos.x = 20.999999999999986`     -> floor(20.9..)  = 20

`pos.x = coord.x - sz.x/2` (addNodeObj), `sz.x = INCH2PS(ND_width) =
103.26562500000003`, `sz.x/2 = 51.632812500000014`.
- C:    `coord.x = 72.632812500000014` (carries the halfwidth error) ->
  `72.6328..14 - 51.6328..14 = 21` exactly (errors cancel).
- PORT: `coord.x = 72.6328125` (exact 9297/128) ->
  `72.6328125 - 51.632812500000014 = 20.999999999999986` (no cancellation).

`coord.x = mid_pointf(bb.LL, bb.UR)` where the osage packing box `bb.UR.x =
ND_xsize(n) = ND_lw + ND_rw`. So the divergence reduces to how `ND_lw+ND_rw` is
computed:
- **C** (`utils.c:1543 gv_nodesize`): `w = INCH2PS(ND_width(n)); ND_lw = ND_rw =
  w/2`. `ND_width` was set by `poly_init` to `PS2INCH(bb.x)` (shapes.c:2372).
  So `ND_lw+ND_rw = INCH2PS(PS2INCH(bb.x)) = 72*(bb.x/72)` — a **round-trip**.
- **PORT** (`nodeinit.ts:storeNodeSize`): called `gvNodesize(widthPts, ...)`
  with the **raw** poly points `widthPts = unflipped.lw+unflipped.rw = bb.x`,
  so `lw+rw = bb.x` — **no round-trip**.

The port's packing box (raw `bb.x`) was therefore inconsistent with
`addNodeObj`'s `sz.x = INCH2PS(ND_width) = 72*(bb.x/72)`, so the
`coord - sz/2` cancellation C relies on was broken -> `floor` flipped 21->20.

### Fix
`src/common/nodeinit.ts:storeNodeSize` — pass the round-tripped points to
`gvNodesize`, exactly as C's `gv_nodesize` reads `INCH2PS(ND_width)`:
```ts
const size = gvNodesize(
  n.info.width * POINTS_PER_INCH, n.info.height * POINTS_PER_INCH, flip);
```
(`n.info.width` was just set to `widthPts/72`, so `*72` reproduces
`INCH2PS(PS2INCH(bb.x))`.) This makes ND_lw/ND_rw/ND_ht bit-identical to C for
every node.

### Ruled out
- R-tree primitives (combineRect fmin-both-sides, RectArea uint64, PickBranch
  u64sub, split-q, Overlap) — all faithful (re-verified).
- Hilbert bag order — identical through INS #24.
- Node draw geometry — matches to %.5g on both sides; the change is a sub-ULP
  round-trip only visible where a floor() sits on an integer boundary.

### Regression note
This touches the shared node-sizing primitive (all engines). It is strictly
*more* faithful (now matches C's exact INCH2PS round-trip). Full osage sweep +
targeted checks used to confirm 0 regressions before commit.

### Accepted-xlabel status (task-requested re-verify) — NO FLIPS
| id | engine | baseline nDiffs | post-fix nDiffs |
|----|--------|-----------------|-----------------|
| graphs-b29 | twopi | 1 (diverged) | 1 (Δ12) unchanged |
| linux.i386-b29 | twopi | 1 (diverged) | 1 (Δ12) unchanged |
| linux.i386-b29 | osage | 2 (diverged) | 2 (Δ37.22) unchanged |
| share-b29 | osage | 2 (diverged) | 2 (Δ37.22) unchanged |
| graphs-b29 | osage | pass | pass (0) |
| share-b29 | twopi | pass | pass (0) |
(2239/2470/1652 are dot-engine ids, not xlabel-accepted under twopi/osage.)

---

## 1447_1 under osage — in-progress (dot primary engine already passes 0 diffs)

1246 xdot diffs, ALL `edge:` draw/pos numeric (0 node diffs). splines=ortho +
ratio=compress. Node draw boxes match to %.5g on both sides. The b106 node-size
fix leaves it unchanged (1246 -> 1246), i.e. a **separate** mechanism.

### First divergence localized to ortho track assignment
First diff: `edge:ASCIInumbers->string_encoding pos[3]` = a **Y** coordinate
(horizontal track): PORT 845 vs oracle 832, Δ13. In the ortho maze this is an
`htrack` output `y = round(lo + (1 - trk/(nseg+1))*(hi-lo))`. Channel width
~64, nseg~12 -> one track step ≈5, so Δ13 ≈ a **2-3 track-number difference**
(discrete), NOT an FP residual amplification (a sub-0.01 node shift can only
move y by <0.01 through the interpolation).

Track numbers come from `assignTrackNo` = topological/longest-path over the
precedence graph built by `add_edges_in_G` from pairwise `seg_cmp`
(ortho.c:646). So the divergence is in either (a) `seg_list` ordering within a
channel (order segments were routed/added), or (b) `seg_cmp` tie results, or
(c) the topological-sort tie order. C reference captured: 916 htrack + 658
vtrack calls (VT_DUMP instrumentation on ortho.c htrack/vtrack).

### Next step (blocked on running osage sweep — cannot edit src mid-sweep)
Instrument port `htrack`/`vtrack` (ortho-route.ts, fields commCoord/p.p1/p.p2/
trackNo/segList.length/cp.bb) identically to the C VT_DUMP, diff the ordered
traces; the first line differing in (lo,hi,trk,nseg) says channel-partition vs
track-assignment. Then compare port `segCmp` + seg_list build order
(insertChan/assignSegs) against C add_edges_in_G / assignTrackNo. Candidate
classes: seg_list insertion order, seg_cmp parallel-segment tie, longest-path
tie order.
