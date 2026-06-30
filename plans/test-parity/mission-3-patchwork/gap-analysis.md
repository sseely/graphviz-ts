# Mission 3 — patchwork gap analysis (T1 recon, 2026-06-10)

Baseline at mission start: 984 passed / 38 failed (matches
baseline-after-m2.md). All 6 patchwork goldens fail with the SAME
single divergence.

## Finding

Element-by-element diff of all 6 actual-vs-ref SVGs shows ONLY the
cluster polygons differ — node polygons, text positions, fonts, and
canvas dims are conformant. Our cluster bbs are still in the
tree's centered coordinate system (e.g. patchwork-cluster:
(-83.67,-83.67)..(83.67,83.67)); the ref has them translated so the
root LL is the origin. Translating our cluster bbs by -root_bb.LL
reproduces the ref values exactly (-83.67+83.67=0, 23.9+83.67 →
59.76/... verified numerically for cluster and simple).

## Root cause

C pipeline: patchwork_layout → patchworkLayout (walkTree sets GD_bb
for clusters AND the root in centered coords) → dotneato_postprocess
→ translate_drawing → translate_bb, which shifts node coords AND
recursively shifts every cluster GD_bb (+ label pos) by -bb.LL.

Our port calls pack's normalizeGraphBB, whose shiftOneGraph moves
node coords/pos ONLY — cluster bbs are never translated. (Same gap
exists in pack's shiftGraphs used for component packing: C's
shiftGraph recurses into GD_clust; ours doesn't.)

Also: normalizeGraphBB derives the offset and final root bb from the
NODE union; C uses the root GD_bb (the tree rect). They coincide for
the current 6 tests (verified: only the cluster polygons differ, and
canvas dims already match the refs), but C semantics is root-bb-based
— use it.

Cluster labels: C patchwork mkClusters does NOT call do_graph_label;
ref for patchwork-cluster contains no GroupA/GroupB text. Do not add
cluster labels.

## Fix (single task)

T2: extend pack shiftOneGraph to shift g.info.bb (when set), the
graph label pos (when set), and recurse into info.clust per C
lib/pack/pack.c:shiftGraph (journal: src/layout/pack/*). In
patchwork, replace normalizeGraphBB with a translate_drawing
equivalent that offsets by -root_bb.LL and leaves root bb at
(0,0)..(w,h).

Risk: shiftOneGraph is shared with twopi/circo normalizeGraphBB and
neato/fdp/twopi component packing (shiftGraphs). Shifting cluster bbs
there matches C (translate_bb / shiftGraph both recurse clusters);
gates are the canary.
