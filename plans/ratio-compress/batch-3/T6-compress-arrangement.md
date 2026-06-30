<!-- SPDX-License-Identifier: EPL-2.0 -->
# T6 — compress x-NS arrangement divergence (OPEN, own mission)

## Why this exists
T1 (commit `6ef3eeb`) activated `ratio=compress` for the first time — the
machinery (`compressGraph` + `containNodes` + the weight-1000 `ln→rn` aux edge)
had been ported but was **dead and never validated**. With it live, the 4
compress corpus graphs get the correct overall dimensions and ranks but a
**different within-rank x-arrangement than native dot**, so they improve
maxDelta yet stay `diverged`.

## Evidence (NaN.gv, the canary)
- Overall dims match: port 396 vs native 397pt; ranks/y match exactly
  (`dy=0` for every node).
- Within-rank x diverges: median node displacement **535**, max **1601**,
  signs both ways (some nodes shift left, others right).
- Identical with and without `orientation=landscape` → **pure compress**, not the
  rotation. NaN is cluster-free → **not** the `containNodes` vStart-window bug.
- maxDelta: NaN 1907→1601, 1447_1 3896→3624 (improved, still diverged).

## Hypotheses to test (instrument port vs C, proc3d-style)
Use the instrumentable build dot (`GVBINDIR=/tmp/gvplugins`,
`build/cmd/dot/dot`) with `XNS_DUMP`-style fprintf in `compress_graph` /
`make_LR_constraints` / the x-NS, vs `console.error` in the port equivalents:
1. **Compress constraints differ** — dump the `ln→rn` edge (minlen=`size.x`,
   weight 1000) and `containNodes` edges (`ln→first`, `last→rn`,
   `lw/rw + margin + border`) port vs C. A different minlen/weight/margin
   changes the compressed optimum.
2. **NS degeneracy under compress** — the weight-1000 objective makes the x-NS
   highly degenerate (many equal-cost arrangements); port and C may pick
   different optimal vertices (cf. the proc3d x-NS finding, but amplified). If
   constraints match, this is the cause — and matching C means replicating its
   enter/leave-edge + balance tie-breaks exactly under compress.
3. **`contain_nodes` margin/border** — `graphMargin`, `borderLeft/Right` for the
   root may differ from C's `CL_OFFSET`/`GD_border` defaults.

## Risk / scope
Touches the x-coordinate network simplex and compress constraints — delicate,
shared with every dot graph. A real bug (hypothesis 1/3) is fixable and
oracle-validatable; pure degeneracy (hypothesis 2) may be a fidelity floor like
the proc3d x-NS/font-metric delta (`docs/known-divergences.md` A2). Determine
which **before** editing the x-NS.

## Affected graphs
`graphs/NaN`, `share/NaN`, `windows/NaN` (compress+landscape), `1447_1`
(compress, box3d nodes). All currently diverged-improved.

## Done when
The 4 compress graphs reach byte/structural-match, OR the residual is shown to be
the known x-NS degeneracy floor and documented as an accepted delta (A-series in
`docs/known-divergences.md`).

## INVESTIGATION RESULT (2026-06-24) — NOT compress; base x-NS structural diff

Instrumented `make_aux_edge` (C) vs `makeAuxEdge` (port) for NaN, with and
without compress. Conclusions, all verified:

1. **Compress is correct.** Simple compress graphs are conformant (0
   displacement). For NaN, compress adds an *identical* 21 aux edges in both
   (with−without: C 471−450, port 483−462, both +21), and the weight-1000
   `ln→rn` edge matches exactly (`1152, 1000` both). Hypotheses 1 & 3 (compress
   constraint / margin bug) are **refuted**.
2. **Not NS degeneracy.** The aux constraint graphs are *structurally
   different*: port builds **483 vs C 471** edges (and **462 vs 450 without
   compress** — same +12). Degeneracy would have identical graphs. Hypothesis 2
   **refuted**.
3. **Root cause = pre-existing base x-NS difference.** NaN's within-rank
   x-arrangement diverges **with OR without compress** (uncompressed: max disp
   1784, median 691; ranks/y match, `dy=0` always). The +12 edges are
   concentrated in the weight-1/weight-2 `make_edge_pairs` edges
   (C 212×(1,1)+12×(1,2) vs port 226×(1,1)+10×(1,2)) → port has ≈6 extra
   `make_edge_pairs` saved-out-edges plus a weight-1↔2 redistribution. Plus
   font-metric minlen±1 noise (label widths, the proc3d A2 class).

**Reframe:** this is NOT a compress problem. compress (T1) is correct and can be
considered done. NaN diverges because its **base x-coordinate network simplex
constraint graph differs structurally** (≈6 extra `make_edge_pairs` saved-out
edges → +12 weight-1/2 aux edges; a weight redistribution), independent of
compress — upstream in the post-mincross edge/virtual structure or edge-weight
assignment (`make_edge_pairs` iterates `ND_save_out`). Unlike proc3d (counts
matched, font-metric only), NaN has a genuine structural constraint difference →
likely a real, fixable bug in the base x-NS edge structure, but a **separate,
broader investigation** (affects NaN regardless of compress).

**Next (new scope, not compress):** instrument `make_edge_pairs` / the
post-mincross `ND_save_out` edge set port-vs-C for NaN to identify the ≈6 extra
edges and the weight-1↔2 difference. That is the real lever for NaN's parity.

## ≈6-EDGE INVESTIGATION RESULT (2026-06-24) — 2-cycle back-edge double-count

Instrumented `make_edge_pairs` C-vs-port for NaN (`MEP_DUMP`). The +12 aux edges
= ≈6 extra real→real (both NORMAL) `make_edge_pairs` edges. Identified them by
name: `NRAtom→AtomProperties`, `InterpF→Interp`, `LoadState→LoadStateRep`,
`Target→Event`, `Target→TThread`, `Target→TargetF`. **All six are 2-cycles** —
NaN also has the reverse edge (`AtomProperties→NRAtom`, `Interp→InterpF`, …).

For each pair: **C has one weight-2 edge** (the forward edge merged with the
acyclic-reversed back edge); **the port has the weight-2 edge PLUS a stray
weight-1 edge** (3 edge-units vs C's 2). So the port **double-counts** the
mutual edge.

**Minimal repro (1 line):** `digraph{a->b;b->a}` →
- C `make_edge_pairs`: `1  a->b w2`
- port `make_edge_pairs`: `1 a->b w2` **+** `1 a->b w1`

(Simple same-direction parallels `a->b;a->b` merge correctly in BOTH → it is
specifically the *reversed* back-edge of a 2-cycle.)

**Localization.** `reverseEdge` (`fastgr.ts:275`) mirrors C `reverse_edge`
(delete → `findFastEdge(head,tail)` → merge-or-create) but also sets
`e.info.reversed = true`. The stray edge points to the port's back-edge
bookkeeping (the known `ND_out` vs `ND_other` reversed-edge split — see memory
`edgeNormalize ND_out vs ND_other`): the reversed mutual edge is reachable/counted
twice (once merged into the forward fast edge, once as a leftover), so
`allocate_aux_edges`/`make_edge_pairs` sees an extra `ND_out` entry.

**Effect (the real lever):** these stray edges perturb the base x-coordinate
network-simplex constraint graph → NaN's within-rank arrangement diverges (with
OR without compress). Graphs with 2-cycles are the affected class.

## NEW TASK — T7: fix 2-cycle back-edge double-count
- **Repro/test:** `digraph{a->b;b->a}` must produce exactly one `a->b` fast edge
  (weight 2) post-acyclic; assert `make_edge_pairs`/`ND_out` has no stray copy.
- **Fix region:** port acyclic/`reverseEdge` + the `reversed`-edge `ND_out`/
  `ND_other` bookkeeping (`fastgr.ts`, the acyclic pass). Determine why the
  reversed mutual edge survives as a second `ND_out` entry after the merge.
- **Validate:** NaN/1447_1 maxDelta drop; **0 regressions** (back-edge handling
  is shared by every cyclic digraph — high blast radius, full survey required).
- **Risk:** touches acyclic/fast-graph, used by all cyclic graphs. Oracle-pin a
  handful of 2-cycle goldens before/after.
