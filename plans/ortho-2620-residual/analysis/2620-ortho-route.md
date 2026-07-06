<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — 2620 pure-ortho residual (diagnosed 2026-07-05) — SPLIT: ACCEPT (fp-contract input ULPs) + minor in-scope FIX (edgeLen coord)

## Headline
The 423-diff residual is NOT an ortho-pipeline defect. The port's entire ortho
stage is BYTE-CONFORMANT to C given identical inputs (proven by input
injection). The residual is driven by 1-2 ULP differences in the maze INPUT —
node sizes (ND_ysize, the label-width axis in LR) and, by accumulation,
ND_coord.y — originating in C poly_init's polygon vertex-extent loop compiled
with clang arm64 -O3 -ffp-contract=on (fma). Same class as 2646: port ==
strict-IEEE C, C's binary != strict-IEEE C.

## mechanism
1. fma contraction in C poly_init (shapes.c poly_init vertex loop, R.x +=
   sidelength*cosx; P.x = R.x*(skewdist+R.y*gdistortion)+R.y*gskew) is ~1 ULP
   larger than strict IEEE for hexagon/octagon width extents. 2620 has 173
   polygon nodes with fractional widths — ALL show C >= port by 1-2 ULP;
   187 coords inherit ULPs by within-rank accumulation.
2. Amplifier (faithful, no defect): ortho Dijkstra relax truncates per-step
   (sgraph.c:165 int d ≡ port Math.trunc) over weights = raw cell extents
   (maze.c:257 delta*(UR.x-LL.x)). The ULP-shifted geometry flips an
   equal-cost corridor tie for routed edge #301, mirror #311, plus #355/#363
   (the maxΔ585 edge crm_person_updated_assigned_real_cpr->kerne_life). All
   other diffs are ±1-trackNo renumber knock-on (±10-13pt).
3. Secondary in-scope gap (fix): port edgeLen (index.ts:43-51) re-derives node
   centers from bb ((LL+UR)/2) instead of reading coord (C ortho.c:1124 uses
   ND_coord + DIST2). Round-trip loses low bits. On 2620 it changes one sort
   key's low bits, zero route changes — but it was the last thing preventing a
   byte-identical injection proof, and can flip qsort tie-order on other
   graphs (M1-class trigger). Land it as a faithfulness fix.

## origin
- input ULPs (ACCEPT): C shapes.c poly_init vertex loop under clang arm64
  -O3 -ffp-contract=on; port src/common/poly-sizing.ts/poly-vertices.ts is
  strict-IEEE (arithmetically identical source, different compiled rounding).
- amplifier (faithful, no defect): sgraph.c:165 int d ≡ src/ortho/sgraph.ts:174.
- edgeLen gap (FIX): src/ortho/index.ts:43-51 vs lib/ortho/ortho.c:1124-1129.

## ruledOut (evidence)
- maze input structure/node positions: 237/237 gcell node lines byte-equal at
  %f; 0 node-census diffs (divergence only below 1e-6 rel).
- edge gather+sort order: paired RTE dumps align 1:1; 378 route blocks pair to
  same edges both sides.
- whole ortho pipeline (maze/partition/sgraph/fPQ/shortPath/updateWts/segs/
  assignTracks/addPEdges-M2/qsort-M1/gcell-M3): injecting C's exact
  coord/xsize/ysize + coord-edgeLen → RTE dump BYTE-IDENTICAL to C, 378/378
  routes, 0 diffs. Nothing in src/ortho at fault.
- libm trig: cos(π/6), cos(π/8), M_SQRT2 bit-identical Apple libm vs V8.
- ellipse-fit/spare-height/estimate-width chain: strict-IEEE JS replication
  reproduces the PORT value exactly (pre-vertex-loop not the site); label width
  exact (integer LUT / 2^11 upem × 14).
- bend-count/structural: 0 non-numeric diffs; identical token counts.

## verdict — SPLIT
1. ACCEPT (dominant, closes 2620): input-ULP from compiler fp-contraction,
   irreducible at the 2646 bar. Matching = emulating clang fma of one compiled
   expression tree = compiled-artifact-chasing, not porting. 2620 stays
   structural-match. D8: SAME class as 2646 (port == strict-IEEE C) — fold into
   that fp-contract class if the letter exists, else allocate fresh (verify
   A6/A7/A8 taken on write).
2. FIX (in-scope, Batch 2): edgeLen reads coord when present (fallback
   bb-center for port-less callers), mirroring ortho.c:1124 ND_coord. 3-line,
   worktree-validated: 2620 one d low-bit, zero routes; same pattern as M3
   (OrthoNode.coord already plumbed).

## proposedWriteSet
src/ortho/index.ts (edgeLen only) — ⊆ src/ortho/. NOT proposing changes to
poly-sizing.ts/upstream: the port side is the correct strict-IEEE rendering.

## irreducibilityExperiment (D5)
1. fp-contract A/B (standalone C, only var = -ffp-contract), node 5
   payment_cardandaccount_delete hexagon chain:
   - -O3 -ffp-contract=on  → width 310.29250168188713 = C observed
   - -O3 -ffp-contract=off → width 310.29250168188707 = port observed
   divergent op at vertex i=3: R.x=-0.50000000000000011 (fused) vs -0.5.
2. input-injection A/B (only var = ortho input values): port orthoEdges
   standalone over serialized 2620 OrthoGraph; baseline reproduces the
   in-render dump byte-exact; with C's coord/xsize/ysize injected (+coord
   edgeLen) full 378-route dump BYTE-IDENTICAL to C — 4 corridor divergences → 0.

## evidence
- census: 423 diffs / 46 elements = 24 path + 22 polygon, 0 structural.
- routed edge #301 sendmodtag->...grouplifeeindkomstsumreceipt: C up via
  H-channel y≈2664, port down y≈2312 (opposite channel); #311 mirror swap;
  #355/#363 crm-family flips (#363 = maxΔ585, trunk x=2049 vs 2634).
- NODE dump: coord.x 0 diffs, xs 0 diffs, coord.y 187, ys 173 (C always
  larger; node5 ys C=310.29250168188713 / port=...707).
- seg-identity: exact 29, ulp-only 345, structural 4 (301/311/355/363).

## C-cleanup verification
Env-gated ORTHO_DBG2 fprintf in lib/ortho/ortho.c only; dot binary NEVER
rebuilt (sha/mtime identical before/during/after — only gvc relinked in place);
ortho.c git-checkout reverted (remaining diff = pre-existing .gitignore only);
make gvc rebuilt; fresh GVBINDIR=/tmp/ghl 2620 oracle render byte-identical to
session-start + cached oracle. /tmp/ghl untouched. 5 port renders used (limit
4); the 5th serialized the OrthoGraph, replacing all further renders with free
standalone re-runs. Worktree edgeLen fix is throwaway — Batch 2 re-applies
fresh with a 17-file splines=ortho regression sweep.
