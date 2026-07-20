<!-- SPDX-License-Identifier: EPL-2.0 -->

# Residual tracker — post-T1 neato diverged (T2)

Source: fresh deleted-JSONL neato sweep committed with T1 (`fe2d315`).
`test/corpus/parity-neato.json` = **665 pass · 90 diverged · 7 oracle-error**.

## Headline: the B1 bucket was a *symptom* cluster, not one cause

`buckets.json` grouped 44 ids by the graph background-fill `_draw_` diff. T1
fixed the **confirmed** mechanism (self-loop/curved-edge spline bulge undercounted
in disconnected-component packing) → **5 ids fixed** (`graphs-nhg`, `graphs-b`,
`graphs-b117`, `graphs-pgram`, `graphs-b94`), 0 regressions. The remaining 90
diverged are **heterogeneous**; T2's re-triage below replaces the stale buckets.

**Deviation from brief:** T2's acceptance target (diverged ≤ 51) assumed B1 was a
44-id lever. It was not — 38 graph-fill residuals with *distinct* causes remain,
and Batch 3 as planned (B2/B3/B4/B5 only) has **no task** covering them. See
"Scope gap" below. This does not undo T1 (the one confirmed chaseable cause is
fixed at origin); it corrects the plan's cost model.

## Residual by bucket (90 total)

| bucket | count | signature | Batch-3 task |
|--------|------:|-----------|--------------|
| graphfill (B1-residual) | 38 | `[graph] _draw_ …filled_polygon` | **none — gap** |
| B2 spline | 37 | `edge:… _draw_ …bezier` | T5 |
| B4 label | 8 | `edge:… _ldraw_` | T4 |
| B3 cluster | 4 | `cluster:… _draw_` | T3 |
| B5 arrow | 3 | `edge:… _h/tdraw_` | T5 |

## Graph-fill 38 — sub-cause analysis (bb ratio = port_bb / oracle_bb)

The graph fill traces the bb, so the ratio reveals the cause:

### GF-A · overlap-removal UNDER-scale (ratio 0.40–0.77) — ~16 ids · GENUINE, distinct cause
`nshare-overlap_neato1`(0.40) `2609`(0.43) `linux.x86-overlap_neato1`(0.59)
`2556`(0.61) `linux.x86-overlap_neato` `nshare-overlap_neato`
`linux.x86-neatosplines_neato` `nshare-neatosplines_neato`
`nshare-neatosplines_neato1` `linux.x86-neatosplines_neato1`(all 0.68) `2258`(0.74)
`share-newarrows` `windows-newarrows` `linux.x86-arrows_dot` `macosx-arrows_dot`
`nshare-arrows_dot`(0.77)
- Mechanism: `overlap=false` single-component layouts; port bb is ~0.4–0.8× the
  oracle → overlap removal (`src/layout/neato/overlap.ts` / `maybeRemoveOverlap`,
  VPSC) does not expand as far as the oracle's PRISM/scale pass. **Confirmed on
  2609** (K4, 1 component, node coords ~half oracle). **Outside T1 write-set** —
  not a packing/lone-node bug. → **new task needed (overlap-scale); not in brief.**

### GF-B · near-match small / iterative drift (ratio 0.94–1.02) — ~19 ids · likely A1-accept
`2563`(0.94) `graphs-arrows`/`graphs-arrowsize`/`graphs-newarrows`(0.95) `1436`(0.98)
`2239`(0.98) `graphs-Symbol` `graphs-Helvetica` `2095` `1949` `2193`(~1.00)
`windows-trapeziumlr` `share-trapeziumlr` `windows-pgram`(~1.00)
`linux.x86-root_twopi`(n=32621) `nshare-root_twopi`(n=32798)
`linux.x86-root_circo`(n=31581) `2475_2`(n=283014) `2095_1`(1.02)
- bb within ~2% of oracle; the huge-nDiffs ids (`root_twopi`/`root_circo`/`2475_2`
  = 30k–283k tiny diffs) are the **A1 iterative-drift** signature (accept-class
  per the existing A1–A9 discipline). Shape-family (`trapeziumlr`, `pgram`, arrows)
  are small sub-pt geometry — verify a couple; likely accept-drift or tiny
  shape-bb rounding. Not obviously B2/B3/B4/B5.

### GF-C · over-scale outliers (ratio > 1.08) — 3 ids · GENUINE, distinct
`2242`(1.08) `1855`(1.13) `graphs-b81`(1.96 — port 73381 vs oracle 37491, 2× too big)
- `graphs-b81` is a hard 2× bb blow-up → its own defect; investigate separately.

## Full per-id table (bucket · nDiffs · firstDiff)

| id | bucket | nDiffs | firstDiff |
|----|--------|-------:|-----------|
| 2475_2 | graphfill | 283014 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 13489.64 vs 13553.18 |
| 2095_1 | graphfill | 35525 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[4]: 4816.44 vs 4741.44 |
| nshare-root_twopi | graphfill | 32798 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 1659.28 vs 1658.48 |
| linux.x86-root_twopi | graphfill | 32621 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 1660.06 vs 1659.34 |
| linux.x86-root_circo | graphfill | 31581 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 1533.55 vs 1534.43 |
| 2095 | graphfill | 7323 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 7107.15 vs 7105.57 |
| graphs-b81 | graphfill | 5348 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[4]: 73381.06 vs 37491.22 |
| 2239 | graphfill | 3838 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 1676.96 vs 1702.77 |
| windows-pgram | graphfill | 2833 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[4]: 638.89 vs 638 |
| nshare-overlap_neato1 | graphfill | 1943 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 711 vs 1759.98 |
| linux.x86-overlap_neato1 | graphfill | 1940 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 576 vs 982.76 |
| nshare-overlap_neato | graphfill | 1931 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 531 vs 777.19 |
| nshare-neatosplines_neato | graphfill | 1931 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 531 vs 777.19 |
| nshare-neatosplines_neato1 | graphfill | 1931 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 531 vs 777.19 |
| linux.x86-overlap_neato | graphfill | 1925 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 531 vs 777.18 |
| linux.x86-neatosplines_neato | graphfill | 1925 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 531 vs 777.18 |
| linux.x86-neatosplines_neato1 | graphfill | 1925 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 531 vs 777.18 |
| share-trapeziumlr | graphfill | 1818 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 606.42 vs 607.09 |
| windows-trapeziumlr | graphfill | 1777 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 607.18 vs 606.67 |
| 2193 | graphfill | 1085 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 1683.89 vs 1682.42 |
| graphs-arrowsize | graphfill | 987 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 441 vs 465.68 |
| linux.x86-arrows_dot | graphfill | 967 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 351 vs 454.36 |
| macosx-arrows_dot | graphfill | 967 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 351 vs 454.36 |
| nshare-arrows_dot | graphfill | 967 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 351 vs 454.36 |
| graphs-arrows | graphfill | 938 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 441 vs 465.68 |
| graphs-newarrows | graphfill | 938 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 441 vs 465.68 |
| 1855 | graphfill | 743 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 621 vs 551.16 |
| 2556 | graphfill | 680 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 410.99 vs 671.85 |
| share-newarrows | graphfill | 664 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 351 vs 454.36 |
| windows-newarrows | graphfill | 664 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 351 vs 454.36 |
| 2242 | graphfill | 658 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 407.08 vs 375.67 |
| 1436 | graphfill | 385 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 783.23 vs 796.3 |
| graphs-Symbol | graphfill | 296 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 773.42 vs 774.81 |
| graphs-Helvetica | graphfill | 275 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 508.59 vs 507.75 |
| 1949 | graphfill | 151 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[4]: 317.85 vs 318.74 |
| 2609 | graphfill | 102 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 122.01 vs 282.68 |
| 2563 | graphfill | 72 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 234 vs 247.63 |
| 2258 | graphfill | 42 | [graph] _draw_ [graph]/_draw_/op[2].filled_polygon[3]: 69.04 vs 93.71 |
| nshare-root_circo | B2 | 22549 | edge:1->189E#0 _draw_ edge:1->189E#0/_draw_/op[1].unfilled_bezier[0]: 1369.36 vs 1371.11 |
| share-pgram | B2 | 2073 | edge:Parallelogram->A#0 _draw_ edge:Parallelogram->A#0/_draw_/op[1].unfilled_bezier[0]: 198.17 vs 197.63 |
| 1332 | B2 | 1049 | edge:c5381->c5382#0 _draw_ edge:c5381->c5382#0/_draw_/op[1].unfilled_bezier[5]: 909.97 vs 908.96 |
| graphs-mode | B2 | 474 | edge:ccsfpr2_0_1t_99->359100#0 _draw_ edge:ccsfpr2_0_1t_99->359100#0/_draw_/op[1].unfilled_bezier[0]: 1159.77 vs 11… |
| graphs-grdshapes | B2 | 439 | edge:n15->n16#0 _draw_ edge:n15->n16#0/_draw_/op[1].unfilled_bezier[0]: 780.43 vs 779.16 |
| share-b102 | B2 | 243 | edge:Node103->Node79#0 _draw_ edge:Node103->Node79#0/_draw_/op[2].unfilled_bezier[0]: 444.14 vs 443.06 |
| linux.i386-b102 | B2 | 234 | edge:Node103->Node79#0 _draw_ edge:Node103->Node79#0/_draw_/op[2].unfilled_bezier[0]: 444.14 vs 443.06 |
| graphs-jcctree | B2 | 113 | edge:DEF2->ID2#0 _draw_ edge:DEF2->ID2#0/_draw_/op[1].unfilled_bezier[1]: 168.94 vs 169.46 |
| 1447 | B2 | 98 | edge:0x00400ba6->0x00400b68#0 _draw_ edge:0x00400ba6->0x00400b68#0/_draw_/op[1].unfilled_bezier[0]: 223.96 vs 223.1… |
| windows-crazy | B2 | 79 | edge:7th Edition->8th Edition#0 _draw_ edge:7th Edition->8th Edition#0/_draw_/op[1].unfilled_bezier[1]: 468.42 vs 4… |
| share-ngk10_4 | B2 | 75 | edge:14->18#0 _draw_ edge:14->18#0/_draw_/op[1].unfilled_bezier[2]: 379.09 vs 378.51 |
| windows-ngk10_4 | B2 | 75 | edge:14->18#0 _draw_ edge:14->18#0/_draw_/op[1].unfilled_bezier[2]: 379.09 vs 378.51 |
| windows-b102 | B2 | 66 | edge:Node109->Node79#0 _draw_ edge:Node109->Node79#0/_draw_/op[2].unfilled_bezier[1]: 172.12 vs 171.53 |
| share-crazy | B2 | 61 | edge:7th Edition->8th Edition#0 _draw_ edge:7th Edition->8th Edition#0/_draw_/op[1].unfilled_bezier[1]: 468.02 vs 4… |
| nshare-rankdir_dot1 | B2 | 47 | edge:32V->3 BSD#0 _draw_ edge:32V->3 BSD#0/_draw_/op[1].unfilled_bezier[1]: 703.25 vs 702.69 |
| share-fig6 | B2 | 46 | edge:2->18#0 _draw_ edge:2->18#0/_draw_/op[1].unfilled_bezier[0]: 515.84 vs 516.48 |
| windows-fig6 | B2 | 46 | edge:2->18#0 _draw_ edge:2->18#0/_draw_/op[1].unfilled_bezier[0]: 515.84 vs 516.48 |
| graphs-grammar | B2 | 38 | edge:n10->n11#0 _draw_ edge:n10->n11#0/_draw_/op[1].unfilled_bezier[0]: 356.57 vs 355.94 |
| nshare-weight_dot | B2 | 36 | edge:7th Edition->UniPlus+#0 _draw_ edge:7th Edition->UniPlus+#0/_draw_/op[1].unfilled_bezier[1]: 307.64 vs 307.13 |
| nshare-rankdir_dot | B2 | 36 | edge:3 BSD->4 BSD#0 _draw_ edge:3 BSD->4 BSD#0/_draw_/op[1].unfilled_bezier[5]: 880.16 vs 879.48 |
| linux.x86-rankdir_dot2 | B2 | 35 | edge:4.2 BSD->Ultrix-32#0 _draw_ edge:4.2 BSD->Ultrix-32#0/_draw_/op[1].unfilled_bezier[1]: 871.13 vs 871.7 |
| linux.x86-rankdir_dot1 | B2 | 32 | edge:4.1 BSD->8th Edition#0 _draw_ edge:4.1 BSD->8th Edition#0/_draw_/op[1].unfilled_bezier[0]: 332.48 vs 331.92 |
| nshare-dotsplines_dot | B2 | 23 | edge:7th Edition->Ultrix-11#0 _draw_ edge:7th Edition->Ultrix-11#0/_draw_/op[1].unfilled_bezier[0]: 396.15 vs 396.9… |
| nshare-dotsplines_dot1 | B2 | 23 | edge:7th Edition->Ultrix-11#0 _draw_ edge:7th Edition->Ultrix-11#0/_draw_/op[1].unfilled_bezier[0]: 396.15 vs 396.9… |
| 2183 | B2 | 22 | edge:c->m#0 _draw_ edge:c->m#0/_draw_/op[2].unfilled_bezier[5]: 386 vs 385 |
| 1990 | B2 | 17 | edge:0⋯7 ❰A❱->0⋯1 'a'#0 _draw_ edge:0⋯7 ❰A❱->0⋯1 'a'#0/_draw_/op[1].unfilled_bezier[ptCount]: 14 vs 8 |
| windows-shells | B2 | 14 | edge:Thompson->Mashey#0 _draw_ edge:Thompson->Mashey#0/_draw_/op[1].unfilled_bezier[5]: 434.27 vs 434.87 |
| 241_0 | B2 | 13 | edge:1->6#0 _draw_ edge:1->6#0/_draw_/op[1].unfilled_bezier[ptCount]: 14 vs 8 |
| graphs-b15 | B2 | 8 | edge:FaceBack->JumpVertical#0 _draw_ edge:FaceBack->JumpVertical#0/_draw_/op[1].unfilled_bezier[4]: 206.78 vs 206.0… |
| graphs-p | B2 | 2 | edge:sleep->swap#0 _draw_ edge:sleep->swap#0/_draw_/op[1].unfilled_bezier[7]: 78.39 vs 77.86 |
| share-KW91 | B2 | 2 | edge:Act_3->Ext_2#0 _draw_ edge:Act_3->Ext_2#0/_draw_/op[1].unfilled_bezier[7]: 47.06 vs 46.5 |
| graphs-sr_box | B2 | 2 | edge:node62->node63#0 _draw_ edge:node62->node63#0/_draw_/op[1].unfilled_bezier[7]: 1213.84 vs 1214.37 |
| graphs-sl_box | B2 | 2 | edge:node82->node86#0 _draw_ edge:node82->node86#0/_draw_/op[1].unfilled_bezier[7]: 1213.84 vs 1214.37 |
| graphs-sr_box_dbl | B2 | 2 | edge:node62->node63#0 _draw_ edge:node62->node63#0/_draw_/op[1].unfilled_bezier[7]: 1213.84 vs 1214.37 |
| graphs-sl_box_dbl | B2 | 2 | edge:node82->node86#0 _draw_ edge:node82->node86#0/_draw_/op[1].unfilled_bezier[7]: 1213.84 vs 1214.37 |
| 2343 | B2 | 2 | edge:node802->node6132#0 _draw_ edge:node802->node6132#0/_draw_/op[2].unfilled_bezier[7]: 835.31 vs 835.86 |
| 2620 | B2 | 2 | edge:visualcron_skat_pere_archive_reciept_org->visualcron#0 _draw_ edge:visualcron_skat_pere_archive_reciept_org->v… |
| share-clust1 | B3 | 43 | cluster:cluster_c1 _draw_ cluster:cluster_c1/_draw_/op[1].unfilled_polygon[3]: 114.91 vs 114.27 |
| windows-clust1 | B3 | 43 | cluster:cluster_c1 _draw_ cluster:cluster_c1/_draw_/op[1].unfilled_polygon[3]: 114.91 vs 114.27 |
| graphs-clust1 | B3 | 42 | cluster:cluster_c1 _draw_ cluster:cluster_c1/_draw_/op[1].unfilled_polygon[0]: 197.96 vs 197.22 |
| graphs-url | B3 | 8 | cluster:cluster0 _draw_ cluster:cluster0/_draw_/op[2].filled_polygon[4]: 243.9 vs 261.9 |
| 2470 | B4 | 682 | edge:n100->n99#0 _ldraw_ edge:n100->n99#0/_ldraw_/op[2].text[0]: 6930.71 vs 6852.93 |
| share-b29 | B4 | 425 | edge:Node14650->Node14649#0 _ldraw_ edge:Node14650->Node14649#0/_ldraw_/op[2].text[1]: 222.44 vs 270.44 |
| windows-b29 | B4 | 357 | edge:Node14650->Node14649#0 _ldraw_ edge:Node14650->Node14649#0/_ldraw_/op[2].text[0]: 233.58 vs 284.12 |
| 1652 | B4 | 58 | edge:Op_10->Op_35#0 _ldraw_ edge:Op_10->Op_35#0/_ldraw_/op[2].text[1]: 2105.66 vs 2088.86 |
| windows-nhg | B4 | 2 | edge:2->1#0 _ldraw_ edge:2->1#0/_ldraw_/op[2].text[1]: 59.62 vs 42.82 |
| share-nhg | B4 | 2 | edge:2->1#0 _ldraw_ edge:2->1#0/_ldraw_/op[2].text[1]: 58.94 vs 42.14 |
| windows-train11 | B4 | 2 | edge:st10->st0#0 _ldraw_ edge:st10->st0#0/_ldraw_/op[2].text[0]: 75.84 vs 81.41 |
| 2476 | B4 | 2 | edge:s_EnergeticFinch.s_MotionlessCobra->s_EnergeticFinch.s_EmbarrassedMeerkat#0 _ldraw_ edge:s_EnergeticFinch.s_Mo… |
| share-grammar | B5 | 79 | edge:n31->n32#0 _hdraw_ edge:n31->n32#0/_hdraw_/op[3].filled_polygon[1]: 150.66 vs 151.17 |
| 2801 | B5 | 8 | edge:a->b#0 _hldraw_ edge:a->b#0/_hldraw_/op[2].text[0]: 330.01 vs 356.44 |
| windows-viewfile | B5 | 5 | edge:printf->write#0 _hdraw_ edge:printf->write#0/_hdraw_/op[3].filled_polygon[3]: 140.99 vs 141.56 |

## suspectedCause note

T1 moved node positions only in **multi-component neato** graphs (lone-component
packing). The graph-fill residuals reference `[graph]` (bb), not a moved node, so
they are **genuine distinct causes**, not cascades of T1. The B2/B3/B4/B5 rows
reference edges/clusters; Batch 3 verifies whether any are cascades of a residual
mislaid node (most are not — T1 changed few positions).

## Scope gap for the executor / user

Batch 3 (T3 cluster / T4 labels / T5 splines+arrows) covers **52** of the 90
(B2 37 + B3 4 + B4 8 + B5 3). The **38 graph-fill residuals are unassigned**:
- **GF-A overlap-scale (~16)** needs a new task in `overlap.ts` (outside every
  current write-set) — a real, chaseable defect distinct from B1 packing.
- **GF-B (~19)** is mostly A1 accept-class drift (esp. the 30k–283k-nDiff ids) →
  `docs/known-divergences.md` entries, not fixes.
- **GF-C (3)** are genuine outliers (esp. `graphs-b81` 2×) needing their own dig.
