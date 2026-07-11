# twopi/2470 "regression" RCA — NOT a regression; irreducible A1/A9 xlabel knife-edge

**Date:** 2026-07-11
**Verdict:** The reported twopi/2470 pass→diverge flip is **NOT caused by any of
today's port commits**. The port's xdot output for 2470/twopi is byte-identical
across the entire candidate window. The flip is an artifact of the **native
oracle binary being rebuilt at 15:24** (between the 14:22 morning sweep and the
16:33 afternoon sweep). The current oracle is canonical; the morning "pass" was
against a stale/non-canonical oracle. The residual port divergence is a
pre-existing **irreducible A1/A9 floating-point knife-edge** in the twopi radial
layout, amplified by the xlabel R-tree. **No fix; acceptance drafted below.**

---

## 1. Not a regression — proof

`test/corpus/render-one-xdot.ts <2470> twopi` compared to
`dot -K twopi -Txdot` (GVBINDIR=/tmp/ghl) via `compareXdot` @0.01 gives
**298 diffs** — byte-identical at every commit tested, including the base:

| commit | result |
|---|---|
| 2fb8e79 (base, pre-candidate-window) | 298 diffs |
| 1b33154, 015ba47, 77e9e30, 92e0d2a, c1c93a2, 931b1b6, 08d57bc, 04e6b6e | 298 diffs |
| 10f35c6 (HEAD) | 298 diffs |

First diff is bit-for-bit identical across all of them
(`edge:n13->n12#0/_ldraw_/op[2].text[0]: 7270.33 vs 7192.55`). **No candidate
commit — `931b1b6` half-even rounding, `08d57bc` polylineMidpoint fmadd,
`04e6b6e` xlabels int32 key, `c1c93a2` ortho, `77e9e30` poly_init, `015ba47`
neato size — changed 2470/twopi at all.**

## 2. What actually flipped: the oracle binary

- `~/git/graphviz/build/cmd/dot/dot` mtime = **Jul 11 15:24** — between the
  14:22 and 16:33 sweeps.
- The only uncommitted change in the C tree is an **inert debug probe** in
  `lib/neatogen/neatosplines.c` (guarded by `getenv("OSAGE_PROBE")`, unset in
  sweeps) → does not change geometry. Current oracle == canonical clean build.
- For the port (byte-stable) to have "passed" in the morning, the morning
  oracle must have matched it. The pre-15:24 binary was built from a source
  state since reverted (only the inert probe remains). **The morning pass was
  against a non-canonical oracle; the current canonical oracle is the faithful
  reference and the port diverges from it.**

`parity.json` (the dot-track survey that gates the twopi engine-walk membership)
is a generated, un-tracked artifact; 2470's membership shifts as it is
regenerated, which is the other half of why 2470 entered/left the twopi set.

## 3. All 298 diffs are edge-label positions

Every diff is an `_ldraw_` text op (edge label). Zero `_draw_` (splines), node
`pos`, or `bb` diffs — **even at tol 1e-7**. The port's splines, node
coordinates, and bboxes match the oracle to the emission precision. 2470's edge
labels are HTML `<table>` labels (`<td align="left">LOOKBACK</td>`) →
left-justified; ~140 of them cluster on near-coincident anchors.

Each diverging label is shifted by exactly **(+own label width, −one
line-height 16.8)** = one candidate step of the xlabel placer. Sparse HTML edge
labels (3, well-separated) → **0 diffs** (controlled experiment: the placer,
AGSEQ object order, rect rounding and HTML sizing are all faithful; only the
dense cluster diverges).

## 4. Mechanism (neato-family edge labels = xlabels)

In neato-family engines the center edge label is placed as an **external label**
by `placeLabels`/`xladjust` (`lib/common/postproc.c:addXLabels` →
`lib/label/xlabels.c`), anchored at `edgeMidpoint`. `xladjust` picks the
minimum-overlap candidate corner around the anchor; overlap is tested against a
**Hilbert-ordered R-tree** of all objects.

Patient-zero (per matched `XL_DUMP` probes on both C and port, since reverted):
**placement seq=8**, identical anchor `(7000.75, 1124.32)`, seq 0–7 placed
identically on both sides. At the x-left candidate `(6922.97, 1124.32)`:

- C `RTreeSearch` returns **26 leaves → n=5** (4 overlapping nodes + 1 placed
  label) → rejects x-left, ends at x-mid.
- Port `rTreeSearch` returns **0 leaves → n=0** → takes x-left immediately.

Port brute-force scan finds the same 26 overlapping objects C finds — **the
port's R-tree search misses real overlaps.** Root dump: C root = 19 branches,
one MBR `[6850,1017,6997,1124]` covers the high-y cluster (overlaps the query);
port root = 22 branches, none reaching y>805. Different node **grouping** →
different (under-covering, min-min `CombineRect`) MBRs → different pruning.

Note: `CombineRect` in C uses `fmin` on **both** low and high sides
(`lib/label/rectangle.c` — a load-bearing quirk); the port faithfully
replicates it. `PickBranch`/`RectArea` (uint64 wrap via `u64sub`) and the
Hilbert int32 key are all faithful. The tree difference is *not* a port bug in
those.

## 5. Root cause — a ~2-ULP twopi layout coordinate (controlled experiment)

Traced the different R-tree **insertion order** to `objplpmks` producing a
different rect y-low for the first Hilbert-ordered object (node n17):

Full-precision A/B (`addNodeObj`, both sides, probes reverted):

| quantity | C | port |
|---|---|---|
| `ND_coord.y` | 79.5999999999999**09051** | 79.6000000000000**36948** |
| `ND_height`  | 2.2111111111111112493 (identical) | identical |
| `sz.y`       | 159.20000000000001705 (identical) | identical |
| `sz.y/2`     | 79.600000000000008527 (identical) | identical |
| `pos.y = coord.y − sz.y/2` | **−9.95e-14** | **+2.84e-14** |
| `floor(pos.y)` (objplpmks boundary[1]) | **−1** | **0** |

**Everything is bit-identical except `ND_coord.y`, which differs by ~1.3e-13
(≈2 ULP).** That is a twopi radial-layout coordinate (r·sin/cos via libm on the
oracle, V8 `Math` in the port). The coordinate matches at the conformance bar
(node emission is bit-identical at 0.01 and 1e-7), but `floor(coord.y − sz.y/2)`
straddles **exactly 0**, so the rect y-low flips −1↔0. That shifts the Hilbert
key → R-tree insertion order → tree grouping → search pruning → xlabel candidate
selection, cascading into 298 edge-label position flips.

## 6. Classification: irreducible A1/A9

The sole differing input is a twopi radial-layout coordinate whose ~2-ULP
libm-vs-V8 difference is below the conformance bar. There is no deterministic
rewrite that reproduces a non-correctly-rounded libm transcendental at the bit
level (same basis as the accepted **twopi/1855** A1 radial-mirror cos/sin ULP,
**osage/graphs-polypoly** A9 cos ULP, **circo/2475_2** A9 hypot ULP). The
amplifier — `floor()` straddling exactly 0, then an integer Hilbert R-tree — is
faithful C behavior; the divergence originates upstream in the layout, not in
the label/R-tree code (proven by the seq 0–7 bit-match and the bit-identical
`sz.y`/`sz.y/2`). **This is the same "placeLabels tie on drifted surroundings"
A9 class already documented for the b29 twopi family.**

### Ruled out (with evidence)
- Any today's-commit regression — byte-identical across all commits (§1).
- Anchor/spline drift as the *emission* cause — all 298 diffs are `_ldraw_`, 0
  spline/node/bb diffs even @1e-7 (§3).
- Placement ORDER — port uses AGSEQ `nodesInSeq`/`outEdges` (§4); seq 0–7 match.
- Rect rounding — `objp2rect`/`objplp2rect` use round(); positive coords so C
  round == Math.round; `objplpmks` floor/ceil faithful.
- `CombineRect`, `PickBranch`/`RectArea` u64 wrap, Hilbert int32 key — all
  faithful (§4).
- HTML edge-label sizing / left-justify — sparse HTML edge labels give 0 diffs
  (§3 controlled experiment).

## 7. Acceptance draft (registry is outside this task's write-set)

Add to `test/corpus/accepted-divergences-engines.json` under `"twopi"`:

```json
"2470": {
  "class": "A9",
  "bound": "298 draw-op diffs, ALL edge-label _ldraw_ text positions (HTML <td align=left>LOOKBACK labels); every diff = one xlabel candidate step (+label width x, -16.8 line-height y). Splines/nodes/bboxes bit-identical to oracle (0 _draw_/pos/bb diffs even @1e-7). Mechanism: ~140 near-coincident HTML edge-label anchors are placed by the neato-family xlabel placer (postproc.c:addXLabels -> label/xlabels.c). Patient-zero seq=8: node ND_coord.y differs 1.3e-13 (~2 ULP, twopi radial libm sin/cos vs V8 Math) while ND_height/sz.y/sz.y/2 are bit-identical; floor(coord.y - sz.y/2) straddles exactly 0, flipping objplpmks rect y-low -1<->0 -> Hilbert key -> R-tree insertion order -> node grouping (C root 19 branches vs port 22) -> RTreeSearch pruning -> xlabel candidate flip. Sparse HTML edge labels = 0 diffs; xladjust/AGSEQ order/CombineRect(min-min quirk)/PickBranch u64/int32 Hilbert key all faithful. No deterministic rewrite reproduces the libm coordinate. Same class as twopi/1855 (A1 radial cos/sin ULP) and the b29 placeLabels-tie A9 family.",
  "ref": "known-divergences.md#a9-engine-track-twopi-circo"
}
```

## 8. known-divergences.md prose draft

> **twopi/2470 (A9 — radial-coordinate ULP amplified by the xlabel R-tree).**
> 2470 is a 140-edge graph whose edge labels are HTML `<table>` cells clustered
> on near-coincident radial anchors. In the neato family, edge labels are placed
> as external labels by the greedy xlabel placer (`label/xlabels.c`), which
> chooses the least-overlapping candidate corner using a Hilbert-ordered
> R-tree. The port's splines and node coordinates match the oracle to emission
> precision (0 spline/node/bbox diffs), but one node's radial `ND_coord.y`
> differs by ~2 ULP (Apple libm `sin`/`cos` vs V8 `Math`) — below the
> conformance bar, yet it straddles the `floor(pos.y − sz.y/2)` boundary at
> exactly 0 in `objplpmks`, flipping that object's R-tree rect by one unit. The
> resulting Hilbert-order/tree-grouping change makes `RTreeSearch` prune a
> different branch, so ~140 labels each snap to the neighbouring candidate
> corner (each diff a fixed (+width, −line-height) step). The placer, object
> order, rect rounding, `CombineRect` (which faithfully mirrors C's min-min
> quirk) and the int32 Hilbert key are all faithful; the divergence is the
> upstream radial-trig ULP, irreducible for the same reason as twopi/1855.
