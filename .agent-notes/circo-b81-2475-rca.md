# circo b81 + 2475_2 — root-cause analysis (both ATTRIBUTED)

Two last un-attributed circo (deterministic, ±0.01 xdot) divergences.
Both root-caused; **no src change** — each is an acceptance-class divergence.
Node layout is bit-identical in both (verified); the visible diffs are
downstream of a single heuristic/ULP decision.

Oracle: `~/git/graphviz/build/cmd/dot/dot -Kcirco`, `GVBINDIR=/tmp/ghl`.
Note: native xdot wraps long attribute strings with `\`+newline; unwrap
(`sed 's/\\\n[ \t]*//'`) before comparing token widths, else node-label
lines look artificially short.

---

## graphs-b81 — whole-canvas +785.47pt x-shift (5143 diffs)

### First diverging quantity
Whole-canvas `filled_polygon` width 155599.83 (port) vs 154814.35 (native),
Δ = 785.47pt. **Every** node shifts by exactly dx=+785.47, dy=0 (spread
0.01pt); inter-node spacing and the right margin (= rightmost node rx) are
identical. So the node LAYOUT is bit-identical — the whole drawing is a pure
uniform x-translation. bb.ll.x = 0 on both sides; the extra 785.47pt is on the
LEFT margin.

### Mechanism
b81 is a doxygen dump: 133 nodes, 132 edges (a tree), every edge carrying a
multi-KB Erlang-term label. Three edge labels are pathologically oversized —
**32000–36000pt wide, ~6× wider than any node** (one `\n`-delimited segment is
5990 bytes; e.g. edge `39->40` seg9).

circo edge labels are NOT `set` during layout, so `addXLabels`
(`lib/common/postproc.c:498`) hands each to the greedy xlabel overlap-minimizer
`placeLabels`/`xladjust` (`lib/label/xlabels.c`), anchored at `edgeMidpoint`.
`forcelabels` defaults true (`postproc.c:565`), so with no overlap-free slot the
placer dumps each label at the least-overlap-area candidate. Candidate order
(`xladjust`) is LEFT-column first, RIGHT-column last (returns early only on a
zero-overlap position).

For the oversized labels the placer picks a **LEFT** candidate in the port but a
**MID/RIGHT** candidate in native. Confirmed at the *identical* anchor+size for
edge 39->40 (anchor 17623.1,433.3; sz 35862.9×470.4), LEFT-top position:
- native `xlintersections`: n=90, area=20 230 143
- port   `xlintersections`: n=87, area= 7 909 570

The port accumulates a smaller overlap count/area at the same position, so LEFT
looks least-bad; native sees LEFT as very crowded and moves to MID/RIGHT. One
oversized label flipped to the LEFT of its anchor reaches raw x≈0, extending the
raw bbox ~785pt further left; the final translate-to-origin then shifts every
node +785.47.

Port emits the label center = anchor − w/2 = 17931.47; native = anchor + w/2 =
53008.94 (its own nodes 39,40 sit at ~35083 midpoint) — a full-label-width
mirror across the anchor.

### Why the placer diverges (ruled in / ruled out)
- **Recording logic is faithful.** `getintrsxi`, `recordointrsx`,
  `recordlintrsx`, `aabbaabb`, `objp2rect`/`objplp2rect`, `centerPt` all match
  C line-for-line (verified). NOT the bug.
- **The label-placement SEQUENCE differs.** Dumping every `xladjust` call
  (anchor + chosen center) for port vs native: the first 9 match, then diverge;
  the port runs the placer **103** times, native **101**; several `edgeMidpoint`
  anchors differ (set-diff of anchors is non-empty both ways). Because each
  placed label becomes an obstacle for later labels (`.set` check) and the
  neighbour-grid max-dedup makes the accumulated area order-sensitive, a
  different sequence → different obstacle set → different overlap total at the
  same position → the n/area mismatch above → oversized labels flip sides.
- The giant labels' own anchors DO match exactly; their divergence is purely
  from the differing obstacle sequence, not their own geometry.

### Classification & reducibility — ACCEPTANCE candidate
This is a heuristic-placement divergence on pathological input (edge labels 6×
node width), NOT a clean single ULP. The residual driver is the label-placement
sequence (order + membership + a few anchors) feeding the order-sensitive
overlap accumulation. Reducing it requires bit-exact matching of, at minimum:
(a) circo edge enumeration order in `addXLabels`, (b) per-edge spline
`edgeMidpoint` values, and (c) R-tree leaf traversal order in `RTreeSearch` —
across `postproc`, neato spline routing, and the R-tree used by EVERY
xlabel-consuming engine. High blast radius, uncertain convergence (float area
ties). Out of scope for a targeted fix. Node layout is bit-identical, so the
only defect is a 0.5%-canvas oversized-label placement instability.

Proposed `accepted-divergences-engines.json` (circo) entry — registry lives
under `test/corpus/`, outside this task's write-set, so drafted here only:
```json
{
  "id": "graphs-b81",
  "engine": "circo",
  "class": "A-xlabel-placer",
  "reason": "Oversized edge labels (32k-36k pt wide, ~6x node width) placed by the greedy xlabel overlap-minimizer (xlabels.c placeLabels/xladjust, forcelabels=true). The label-placement sequence (order + membership + some edgeMidpoint anchors) diverges from native, so the order-sensitive overlap accumulation picks the LEFT vs MID/RIGHT candidate for one oversized label, extending the raw bbox ~785pt left and uniformly x-shifting the canvas. Node layout bit-identical (dx=+785.47, dy=0 all nodes). Recording logic (recordointrsx/getintrsxi/aabbaabb) matches C exactly; irreducible without bit-exact edge-enumeration + spline-midpoint + R-tree-leaf-order matching (broad blast radius across all xlabel engines).",
  "maxDelta": 785.48
}
```

### known-divergences.md prose draft
> **circo/graphs-b81 — oversized-edge-label placement (A-xlabel-placer).**
> b81 (a doxygen dump) has three edge labels 32000–36000pt wide, ~6× wider than
> any node. circo places unset edge labels with the greedy xlabel
> overlap-minimizer (`lib/label/xlabels.c`) at `forcelabels=true`, dumping each
> at the least-overlap candidate around the edge midpoint. Because the
> label-placement sequence fed to the placer differs slightly from native
> (103 vs 101 placer invocations, a few differing edge midpoints), the
> order-sensitive overlap accumulation selects the left vs the right side for
> one oversized label, extending the bounding box ~785pt and uniformly shifting
> the whole canvas by 0.5%. Node positions are bit-identical.

---

## 2475_2 — one-component circo sub-block reflection (989 diffs) — A9 hypot-ULP

### First diverging quantity
Of 10762 nodes, **only 18** move (>0.5pt), ALL in the `590_` cluster
(component of 28 nodes); the other 10744 are bit-identical. Max displacement
296.7pt. The displaced sub-block is REFLECTED/rotated, not shifted (nodes
174471–174476 keep y, mirror x about a common axis; others rotate).

### Mechanism (fully isolated to a 2-ULP hypot tie)
Minimal repro saved: `.agent-notes/circo-2475-590-repro.dot` (the 590_ cluster
standalone; reproduces 18/28 displaced under `-Kcirco`).

Block-by-block instrumentation of `doBlock`/`position`/`getRotation`
(`lib/circogen/circpos.c` vs `src/layout/circo/{position,position-helpers}.ts`,
probes reverted):
- Block circle-lists (node order around every circle): **identical**.
- Every block's returned `centerAngle`: **identical to 6 digits**.
- The divergence is in `getRotation`→`closestNode` for the len=9 block
  (neighbor = CHILD = `590_174492`):

```
             x (offset)          y   neighbor dist          closest      closest dist
native:  13.677942523567673  0.0  11.078849186321314  590_174492  11.078849186321314
port:    13.677942523567673  0.0  11.078849186321314  590_174423  11.078849186321312
```

The placement offset (x,y) and the neighbor's distance are **bit-identical**.
Node `590_174423` is cocircular with the neighbor: native's `hypot` gives it
`≥ 11.078849186321314` (so the neighbor is kept → `neighbor==closest_node` →
rotation branch `theta=0`), but V8 `Math.hypot` gives `11.078849186321312`
(2 ULP lower), which is strictly `< 11.078849186321314`, so the port selects a
DIFFERENT `closest_node` → takes the rotation branch (rot ≈ 0.349 rad ≈ 20°) →
the sub-block is rotated/reflected. Every displaced node follows from that one
flipped rotation.

`closestNode` (circpos.c:73-92): `for (n : subg) if (hypot(ND_pos(n)+off) <
mindist2) closest=n;` — a strict `<`, so a cocircular pair only flips when one
`hypot` rounds below the other. This is the exact circo hypot-ULP tie already
documented (memory: `label-height-ulp-xlabels`, `hub-fanin-b100-accepted` A3;
CR-hypot REFUTED — fixed 2343, regressed 2168_3). V8 Math.hypot is
correctly-rounded; Apple libm hypot is ±1-2 ULP arg-dependent → the two round
the cocircular distance differently.

### Ruled out
- block tree / biconnected decomposition (circle-lists identical)
- circular node ordering / mincross (`layoutBlock` order identical)
- child angular placement (`centerAngle` identical to 6 digits)
- node positions feeding closestNode (neighbor dist bit-identical → same inputs)
- a real closestNode iteration-order bug: the offset and neighbor distance match
  bit-for-bit; only the competing node's hypot rounding differs.

### Classification & reducibility — A9 IRREDUCIBLE
Pure V8-vs-Apple-libm `hypot` rounding at a cocircular `closestNode` tie. Same
class as accepted circo/twopi trig-ULP divergences (twopi/1855 A1 radial mirror;
circo A9 incircle/trig ties). Irreducible without a correctly-rounded libm
`hypot` on the native side, and CR-hypot in the port was already tried and
rejected (net-negative). No code change.

Proposed `accepted-divergences-engines.json` (circo) entry (registry outside
write-set — drafted here):
```json
{
  "id": "2475_2",
  "engine": "circo",
  "class": "A9",
  "reason": "circo getRotation->closestNode (circpos.c:73-92) hypot cocircular tie flip. For the 590_ component's len=9 block, node 590_174423 is cocircular with the block's CHILD neighbor 590_174492; at the bit-identical placement offset (x=13.677942523567673,y=0) the neighbor distance is 11.078849186321314 on both sides, but V8 Math.hypot rounds 174423 to 11.078849186321312 (2 ULP low, strictly <) vs Apple libm >=...314 (tie kept). The port therefore picks a different closest_node, takes the block-rotation branch (rot ~20deg instead of 0), and rotates/reflects the sub-block (18/28 nodes move, max 296.7pt). 10744/10762 nodes bit-identical. Block tree, circle order, and all centerAngles are bit-identical. Same class as accepted circo/twopi trig-ULP; CR-hypot refuted. Repro: .agent-notes/circo-2475-590-repro.dot.",
  "maxDelta": 296.68
}
```

### known-divergences.md prose draft
> **circo/2475_2 — cocircular closestNode hypot tie (A9).** In one 28-node
> component, circo's `getRotation` (`circpos.c`) picks the block node closest to
> the layout origin via `hypot` to decide the sub-block's rotation. Two
> cocircular nodes are effectively equidistant; V8's correctly-rounded
> `Math.hypot` and Apple libm's `hypot` round that distance 2 ULP apart, which
> flips the strict `<` and selects a different node, rotating the sub-block ~20°.
> 18 of the 28 nodes move (max 297pt); the other 10744 nodes of the graph are
> bit-identical. Irreducible V8-vs-libm transcendental rounding, same class as
> the accepted circo/twopi trig-ULP divergences.
