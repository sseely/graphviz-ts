# Pre-read: share-b51 (diverged, maxΔ 158px) — single node x-balance

## Verdict / scope (baseline parity.json = 520)
- `share-b51` **diverged**, maxΔ **158.15** · `windows-b51` diverged 157.24 (near-twin,
  311/313 lines) · `graphs-b51` diverged **1096.4** (different/smaller variant, 213 lines).
- Graph: `digraph routine` — a deeply-nested cluster CONTROL-FLOW graph
  (cluster_for_15 ⊃ cluster_if_28 ⊃ cluster_if_40 ⊃ cluster_if_52 ⊃ …), very tall
  (bb ~1021×10685). Boxes are basic blocks (`BB N : hL=k : rP=m`). `helvetica/13`,
  `nodesep=0.1`, `ranksep=0.5`. Source carries stale `pos=`/`bb=`/`lp=` (ignored by
  dot re-layout). Native render fast (0.02s) — NOT a slow-tail graph; port renders fine.

## Dominant divergence: node `blok_60` shifted 158px in x
- **bbox MATCHES exactly** (1200×11083, translate identical) → overall sizing correct.
- `flat-geom-diff` worst element: `node blok_60` Δ158, `edge blok_60->blok_61` Δ158.
- blok_60 polygon: C left-x **539.38** → port **381.38** (centers C≈467 / port≈309).
  Same WIDTH (144) and same Y — pure **x** shift, 158px LEFT.
- **Lone outlier in its chain.** blok_58→59→60→61→62 left-x:
  - blok_58 1013.48=1013.48 ✓, blok_59 756=756 ✓, **blok_60 539.38→381.38 ✗(−158)**,
    blok_61 257.26=257.26 ✓, blok_62 335.29=335.29 ✓.
  Neighbors above (59) and below (61) are byte-correct; only blok_60 moves.
- **blok_60 is ALONE on its rank** (singleton; no rank-mates within |Δy|<3). It sits in
  `cluster_if_28` (hL=2, rP=15). Edges: in `blok_59->blok_60` (59 center x≈828), out
  `blok_60->blok_61` (61 center x≈329). C balances blok_60 mid-way (≈467); the port
  pulls it toward blok_61 (≈309). → an **x-coordinate network-simplex balance** (or
  cluster-containment) divergence for a singleton node between two ranks.

## Secondary
- A cluster of ~26–30px node x-shifts: blok_70(30), blok_20/23/47/48/51(27/26),
  blok_78/79(26) — likely the same x-balance family, smaller magnitude.
- Several **spline piece-count** mismatches (Issue-2 signature): blok_10->blok_7 C=8/port=14,
  blok_6->blok_8 C=14/8, blok_48->blok_49 14/20, blok_59->blok_60 8/14, blok_62->blok_64
  20/14, blok_80->blok_81 8/14. These follow from the node x-shifts (route corridors change).

## Classification
NOT A2/font (bbox + most nodes match exactly; this is whole-point, not sub-pixel). A true
**x-coord NS / cluster-containment** layout divergence localized to specific singleton nodes
inside nested clusters. Root-cause entry point: instrument the x-coord network simplex
(make_LR_constraints / rank balance) for blok_60 — why C centers it but the port pulls it to
the out-edge's x. Watch cluster-boundary constraints (cluster_if_28) and edge weight/priority
of the in vs out edge. Compare to known [[contain-nodes-vstart-window]] /
[[cluster-margin-rl-containment]] patterns.

## Reproduce
```
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/share/b51.gv dot
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/share/b51.gv
node test/diagnostic/flat-geom-diff.mjs <c.svg> <port.svg>
```
