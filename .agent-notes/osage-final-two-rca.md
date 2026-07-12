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

## 1447_1 under osage — **FIXED** (cdt Dtoset corrupted-walk port)

1246 xdot diffs -> **0 (conformant)**. All diffs were ortho edge tracks
(Δ up to 118; nodes/bb bit-exact). dot primary engine already passed.

### Instrumentation ladder (each rung matched, narrowing the divergence)
1. htrack/vtrack traces: same segments, same channels (lo/hi/nseg identical),
   same call order — ONLY `trackNo` differed (first: trk=6 port vs 7 C,
   hchan cc=482 nseg=7). Δ13 = 2-3 discrete track steps, not FP.
2. Channel dump: channel SETS identical (294), seg_list ORDER identical,
   final precedence-graph ADJACENCY differed in 29 channels.
3. Post-np-phase adjacency dump: byte-identical -> np edges match; the
   divergence is inside the parallel pass.
4. Parallel-pass decision trace (every addPEdges pair + SPE entry + hop
   channel resolution + removeEdge): IDENTICAL for 451 lines, then the port
   processes h-channel pairs C never touches and C processes v-channel
   pairs the port skips.
5. C channel-VISIT dump: C's add_p_edges walk visits only **157 of 294**
   channels.

### Root cause (mechanism)
C walks the channel dicts with `dtflatten` + `dtlink` (raw `->right`
pointers): ortho.c add_p_edges. Every `chanSearch` in the loop body is a
`dtmatch`, which UNFLATTENs the dict (cdt dtrestore: for DT_OSET the
flattened chain simply becomes the tree again) and TOP-DOWN-SPLAYS it
(cdt dttree.c), rewriting the `->right` pointers under the walker. Channels
moved into left subtrees by splay rotations are silently SKIPPED. This
corrupted walk is deterministic and LOAD-BEARING: it decides which channels
get parallel pairs resolved and which cross-channel SPE hop edges exist,
and those precedence graphs drive top_sort track numbers. The port's
Map-based dicts walked all 294 channels -> different precedence edges ->
different tracks.

### Fix
- `src/ortho/chan-dict.ts` (new): C-exact cdt Dtoset — dttree.c do_search
  loop + has_root/no_root reassembly (DT_MATCH; DT_INSERT incl. containment
  dedup returning the existing object), dtflatten.c RROTATE right-
  linearisation, UNFLATTEN = flag clear (chain IS the tree). The repo's
  generic DtSplay deviates deliberately in not-found reassembly and insert
  attachment (splay-core.ts) — shape-changing, unusable here.
- `Maze.hchans/vchans` -> two-level `CdtOset` mirroring chanItemDisc
  (v, dcmpid/fcmp) and chanDisc (interval p, chancmpid).
- `chansInOrder` -> live `flatten()` + `.right` generator (reads `.right`
  lazily each resume, so mid-walk splays corrupt it exactly like C).
- `chanSearch` -> two `match()` (dtmatch) calls, splaying like C.

### Ruled out
htrack/vtrack math; channel partition; seg_list build order; np-edge phase
(byte-identical); segCmp/propagatePrec/decidePoint/setParallelEdges flip
table (identical decision traces to the divergence); channel iteration
ORDER alone (a sorted walk changed nothing — COVERAGE, not order, was the
issue).

### Verification
tsc clean; npm test 2965/2965; 17 splines=ortho ids under dot all 0 diffs
(2538 = 8 pre-existing, unchanged); same 17 under osage: 1447 52->0 and
1447_1 1246->0, rest 0 (14/2538/2620 not in the osage corpus set); b106
family still 0. Native probes reverted, oracle rebuilt clean.
