# Flat-edge spurious y-slope = a CLASS (258 B->D + b58 4->5)

## STATUS (2026-06-29): BOTH RESOLVED — b58 (0638013), 258 (isAdjFlatCandidate to_virt resolve)

### 258 fix shipped as the SAME-PAIR GUARD (not bare chain-end)
`isAdjFlatCandidate` resolves `adjacent` from the to_virt chain END, but ONLY when
the rep is the SAME logical edge (same unordered {tail,head} pair); otherwise it
falls back to `e.info.adjacent`. Survey (fast-mode 784 + full-790 corroboration):
**+2 conformant (258 AND 121 — a bonus nonconstraint cross-cluster flat), 0
regressions.** 2108 (the one conformant graph in the slow set) verified byte
preserved.

### 2854 hang scare = FALSE ALARM (pre-existing slow, quarantined)
While verifying, the survey appeared "stuck" on 2854. Investigation: 2854's PORT
render is ~13.6 min (perf.json portMs 817795) and this reproduces on CLEAN MAIN
(no 258 fix) — it is a pre-existing perf cost (mincross/xcoord hot path), NOT
caused by the flat fix. The earlier "60s timeout → hang" test was too short to
distinguish slow-from-hung. 6 graphs exceed 60s: 2854(13.6m), 2646(5.6m),
2371(3.2m), 2343(1.7m), 2108(1.3m), 2095_1(1.2m). 2854 alone dominates survey
wall-clock, so it was QUARANTINED (`perf` reason, enumerate.ts MANUAL_QUARANTINE)
— TEMPORARY, pending a render-time profiling mission. The other 5 stay surveyed.
LESSON: a graph being slow under the survey ≠ a regression; check perf.json
portMs and clean-main before assuming the fix caused it.

258 `B->D` root cause: C's `dot_splines_` routes the `flat_out`/`other` edge that
`checkFlatAdjacent` marked; the port's `orderedDotEdges` routes the cgraph
out-edge. For a nonconstraint cross-cluster same-rank flat these are DIFFERENT
objects, linked only through `to_virt`:
  R(routed cgraph B->D) --to_virt--> v(D->B) --to_virt--> M(B->D, adjacent=1)
So the routed edge had `adjacent=undefined` and fell to the generic fitter.
FIX: `isAdjFlatCandidate` resolves `adjacent` from the END of the to_virt chain
(the flat rep M), mirroring C routing the flag-bearing flat-list edge. Ordinary
adjacent flats have no to_virt chain (rep == e), so b58 and all conformant
flats are unaffected. 258 B->D now conformant: `M142.42,-34 C146.43,-34
150.44,-34 154.44,-34` (was sloped -33.7->-34.01).

--- historical (b58) below ---

b58 `4->5` fixed by the to_virt chain-walk in `checkFlatAdjacent` (see ROOT
CAUSE below). Survey gate byte 519->520 (graphs-b58 structural->byte), 0 regr.
258 `B->D` is NOT fixed by the chain-walk — its routed edge is a DIFFERENT Edge
instance than the one `checkFlatAdjacent` marks (the chain doesn't link them),
so adjacency never reaches the routed object. Separate edge-identity follow-up.
Next: instrument 258 to print every B->D Edge object + its to_virt chain, find
where the routed object is created (likely a cross-cluster / constraint=none
clone), and ensure it carries `adjacent` (or that routing looks adjacency up by
cgraph identity, not object identity).


## Observation: two structural-match residuals share one cause
- **Context**: hunting the next structural-match to root-cause after the
  bezier_clip direction fix (519 conformant). Characterized the smallest
  structural-match residuals with `flat-geom-diff.mjs`.
- **Finding**: the two smallest residuals are the SAME bug:
  - `258` (`B->D`, maxΔ0.30): C path `M142.42,-34 C146.43,-34 150.44,-34
    154.44,-34` — perfectly HORIZONTAL at y=-34. Port `M142.42,-33.7 C
    146.43,-33.81 150.44,-33.91 154.44,-34.01` — SLOPED -33.7→-34.01. **x
    identical in both**; only y differs.
  - `graphs-b58` (`4->5`, maxΔ0.24): C horizontal at y=-18; port sloped
    -17.76→-17.92. Same signature.
- **Root signature**: a flat edge's endpoints get `tail_port.p.y != head_port.p.y`
  (small, asymmetric) where C has both = 0, so the line tilts. C keeps flat
  edges horizontal (tp.y == hp.y == ND_coord(n).y).
- **Both cross a cluster/rank-same boundary**:
  - 258: `B` in cluster_G1, `D` in cluster_G2, both `rank=same`, `B->D
    [constraint=none]`.
  - b58: `4` and `5` adjacent on the bottom rank, both also incident to `7`
    (7->4, 7->5) — multiple incident edges → port offsets from dotSameports.
- **Impact**: a real multi-graph class, tractable (flat-edge port-offset
  assignment, NOT the fragile regular-edge spline fitter). Worth root-causing
  per the press-on directive.
- **Confidence**: High (paired C+port SVG diff; identical x, asymmetric y).

## NOT this class (ruled out as targets)
- **1.00 cluster** (b102 ×4, pmpipe ×3, proc3d, xx, 2734, neato1): NOT a clean
  off-by-one. `pmpipe`'s `23296->23310` is a regular (non-flat) multi-segment
  edge whose whole spline is sub-pixel off (clip endpoints Δ0.17/0.14, interior
  control point Δx exactly 1.00 at 299.63→300.63). This is the regular-edge
  spline-fitter / Proutespline class (same family as the documented findMaxDev
  hypot tie-break) — fragile, high-regression, deferred.

## ROOT CAUSE PINNED (2026-06-29) — `e.info.adjacent` lost → generic fitter slopes it

The slope is NOT a port-offset bug. At dispatch both edges have
`tail_port.p.y == head_port.p.y == 0` and equal coords — `makeSimpleFlat` WOULD
draw them horizontal. The real fault: **`e.info.adjacent` is `undefined` at
spline-dispatch time**, so:
- `isAdjFlatCandidate(e)` = false (gates on `e.info.adjacent`) → `makeAdjFlatNoPortEdge`
  declines.
- `hasSidePort(e)` = false → side-port path skipped.
- the non-adjacent box branch (edge-route.ts:392) requires `!isFlatAdjacent`,
  but `isFlatAdjacent(g,e)` = TRUE → skipped.
- `routeFlatEdge` returns false → edge falls through to the **generic fitter**
  (`straightEdgeSplineWithRank`), which slopes it (and offsets the arrow).

`checkFlatAdjacent` DOES run and DOES set `adjacent=1` for both (tOrd/hOrd differ
by 1, `hi-lo<=1` branch). It is lost afterward by TWO different mechanisms:

- **b58 `4->5`** (same edge object; tag survives, adjacent reset):
  `processOtherLabel` (flat.ts:314) does `e.info.adjacent = le.info.adjacent`
  where `le = flatClassRep(e)` follows the `to_virt` chain. Probe:
  `FSOTH 4->5 sameRep=false eAdj=1 leAdj=undefined toVirt=true` — the rep `le`
  was never marked, so line 314 **clobbers** e's correct `1` back to `undefined`.
  C faithfulness Q: in C `flat_edges` the rep `le` IS marked (ED_adjacent(le)=1),
  so `ED_adjacent(e)=ED_adjacent(le)` keeps it 1. Find why the port's rep is
  unmarked (markAdjacent walks flat_out+other of g.info.nlist; the virtual rep
  may not be in those lists, or is marked in a different g/cluster scope).
- **258 `B->D`** (different instance): `checkFlatAdjacent` tags object A (from a
  flat_out/other list), but the spline router dispatches object B
  (`infoTag=undefined` at dispatch). `processOtherLabel` never runs on B->D.
  The marked edge and the routed edge are different objects → adjacent never
  reaches the routed one.

Probes (all reverted): FSDBG in edge-route.ts routeFlatEdge; FSCFA/FSOTH/__fsTag
in flat.ts checkFlatAdjacent/processOtherLabel.

## Next step (fix)
Read C `lib/dotgen/flat.c:flat_edges` to see how ED_adjacent reaches BOTH the
routed edge and the to_virt rep. Likely one faithful fix covers both: ensure the
rep is marked before the `other`-loop copy (b58), and ensure the routed cgraph
edge is the same object that carries `adjacent` (258) — or that the copy in
processOtherLabel does not clobber a set value with an unmarked rep. Verify both
graphs + survey gate (watch the 14 already-conformant adjacent-flat graphs).
