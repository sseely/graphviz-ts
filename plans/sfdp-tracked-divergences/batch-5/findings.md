# Batch 5 findings — B5 edge-label RTree class (8 ids)

## Verdict: ALL 8 RESOLVED by the sfdp postprocess frame fixes (2 commits). No
RTree-lossy accept needed — the "lossy floor-boundary" the prior session
measured was a symptom of the wrong addXLabels frame, not the root.

The B5 ids all had injection signature `edge/lp + edge/_ldraw_` (edge-label
placement). Split by connected-component count:

### Single-component (5) — cleared by the single-component fix (commit fa0240b)
1652, graphs-b29, linux.i386-b29, linux.i386-b106, linux.x86-root_twopi,
linux.x86-root_circo. `splineEdgesShifted` leaves g.info.bb.ll at origin, so the
routing box already matched C's frame; the old geometric recompute+shift only
broke graphs whose routing box carried extra extent (labels/curves). After the
fix, injected renders clear to 0 diffs → drift-exonerated.
- **1652** (the prior "RTree-lossy irreducible" representative,
  [[sfdp-edge-label-rtree-lossy]]): injected 288→**0**. The single objplpmks
  floor()-boundary rect the prior session isolated was itself produced by the
  frame offset — with the frame corrected, no boundary crossing, RTree matches,
  labels match.

### Multi-component (2) — cleared by the multi-component fix (this batch)
- **2470** (7 components): injected 56→**0**.
- **2095_1** (44 components): injected 32→**0**.
Root: `postprocess` else-branch did a premature `shiftOneGraph(-bb.ll)` BEFORE
`gvPostprocess`→`addXLabels`. `objplp2rect` builds the xlabel obstacle rects
with `round()`; running placement in the origin frame instead of C's packed
(pre-translate) frame tips the side-selection knife-edge (same X, wrong Y — the
77.7pt / 7.6pt `lp` shifts). Fix mirrors the neato path (commit 1e7515d): drop
the premature shift, set `g.info.bb = computeSubgraphBB`, let
`gvPostprocess`→`translateDrawing` shift after addXLabels.

### Note on the prior characterization
2475_2 and nshare-arrows_dot (named in the original batch-5 overview) were
already drift-exonerated by Mission 0 (not in the tracked 17). The RTree
faithfulness proof in [[sfdp-edge-label-rtree-lossy]] still stands (the RTree IS
faithful); what changed is that the *input* to the RTree (the frame the rects
are rounded in) is now correct, so the lossy gap coincides with native.
