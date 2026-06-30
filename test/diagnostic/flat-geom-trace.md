<!-- SPDX-License-Identifier: EPL-2.0 -->

# Flat-geometry trace — 2368.dot (mission 2368-conformant, Batch 0 / T0)

Pins the two flat-edge residuals that block `2368.dot` conformant. Diagnostic
only — produced by temporary, env-gated C instrumentation (reverted after
capture) plus the committed `flat-geom-diff.mjs` harness.

## Recipe

```sh
# port + C SVGs
GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/2368.dot dot > 2368.port.svg
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/2368.dot > 2368.c.svg
node test/diagnostic/flat-geom-diff.mjs 2368.c.svg 2368.port.svg
```

C instrumentation (temporary; reverted): `getenv("FGEOM")`-gated `fprintf` in
`lib/dotgen/dotsplines.c` at `make_flat_adj_edges` (entry: tn/hn/cnt/labels +
each edge dir+label) and `makeSimpleFlatLabels` (tp/hp/ctrx + earray order after
`edgelblcmpfn` with dimen). Rebuild `make -C build gvplugin_dot_layout`, regen
`/tmp/ghl`, capture, `git -C ~/git/graphviz checkout -- lib/dotgen/dotsplines.c`,
rebuild clean.

## FGEOM trace (clean C, 2368) — flat adjacent groups

```
make_flat_adj_edges e0=76->376  tn=76  hn=376 cnt=3 labels=2  edges=[76->376(none), 76->376 from1, 376->76 to1]
  makeSimpleFlatLabels tn=76  hn=376 cnt=3 n_lbls=2 tp=(-23,8.8) hp=(69,8.8)  ctrx=23
    earray[0] 76->376  from1 dimen=(19.5508,9.6)   <- straight (e0), label ABOVE
    earray[1] 376->76  to1   dimen=(10.2227,9.6)   <- DOWN arc (i=1 odd), label BELOW
    earray[2] 76->376  (none)                      <- UP arc (i=2 even), invis
make_flat_adj_edges e0=376->196 tn=376 hn=196 cnt=2 labels=2  edges=[196->376 from2, 376->196 to2]
  makeSimpleFlatLabels tn=376 hn=196 cnt=2 n_lbls=2 tp=(69,8.8) hp=(161,8.8) ctrx=115
    earray[0] 196->376 from2 dimen=(19.5508,9.6)   <- straight (e0)
    earray[1] 376->196 to2   dimen=(10.2227,9.6)   <- DOWN arc
make_flat_adj_edges e0=436->256 tn=436 hn=256 cnt=2 labels=2  edges=[256->436 to2, 436->256 from2]
  makeSimpleFlatLabels tn=436 hn=256 cnt=2 n_lbls=2 tp=(251,8.8) hp=(343,8.8) ctrx=297
    earray[0] 436->256 from2 dimen=(19.5508,9.6)   <- straight (e0)
    earray[1] 256->436 to2   dimen=(10.2227,9.6)   <- DOWN arc
```

(Plus four cnt=1 labels=0 groups: line16->316, 316->76, 196->436, line11->16,
line7->136 — straight invis spindles, already conformant.)

## Issue 2 (Batch 1) — adjacent labeled-flat curve geometry — PINNED

**Root cause.** C `make_flat_adj_edges` groups every adjacent no-port flat edge
between a node pair by the **unordered** {tail,head} set (`dot_splines_`'s sorted
edge list + `getmainedge`/`ED_adjacent` "all flat adjacent edges at once" loop,
dotsplines.c:342-366). So opposing legs `76->376` and `376->76` AND the parallel
invis `76->376` are ONE group (cnt=3). `edgelblcmpfn` then orders by larger
`dimen.x` first, so the wide `from1` is `earray[0]` (straight stub `[tp,tp,hp,hp]`,
label above), and the narrow `to1` is `earray[1]` → routed as a **down-arc** via
`simpleSplineRoute`, label below.

The port's `collectAdjFlatGroup` (splines-flat-labeled.ts) keys on the **ordered**
(tail,head): `f.tail===e.tail && f.head===e.head`. So `376->76 to1` forms its own
cnt=1 group and is drawn straight as `e0`. Result: port draws `to1`/`to2` as
straight horizontal stubs where C draws down-arcs.

**Diff signature.** `376->76`, `376->196`, `256->436` (the `to1`/`to2` legs):
`COORD-COUNT C=14 port=8` — C 7-pt arc vs port 4-pt straight stub.

**Target geometry (C SVG, final coords).**
- `76->376` "from1" (earray[0], straight): `M234.11,-13.75 C243.94,-13.75 255.16,-13.75 265.48,-13.75`, label (253, -19.15) [ABOVE rank].
- `376->76` "to1" (earray[1], down-arc): `M273.31,-4.56 C268.33,-3.14 263.11,-1.9 258.11,-1.15 250.49,0 242.34,-0.98 234.83,-2.8`, label (253, -3.55) [BELOW rank].
- `376->196` "to2" / `256->436` "to2": analogous down-arcs (label y=-3.55).

**Orientation note.** For the reversed leg (e.g. `376->76`, tail right of head),
C builds route points tp→hp (left→right from the GROUP's tn/hn) then
`clip_and_install(e, aghead(e), …)` emits them tail→head (right→left). The C SVG
path for `376->76` runs x 273→234 (right→left). The port fix must reverse the
sampled points for a leg whose tail is the right node (cf. the existing
`makeFlatLabeledEdge` `tailIsLeft` + reverse + `ignoreSwap`).

## Issue 1 (Batch 2) — flat-label-rank vertical spacing — NOT INDEPENDENT

**Finding.** The bbox is 5pt taller in C (608×148 vs 604×143), translate ty Δ4.95.
But the inter-rank node **spans are identical**: top-rank center → bottom-rank
center = 117.8 in BOTH C and port. Every node shows exactly the same 4.95 shift.
So this is NOT a per-rank `ht1`/`ht2` positioning delta.

`flat_edges` (flat.c:259) stores only label **width** for adjacent labeled flats
(`ED_dist = dimen.x`); the `FIX:` comment at flat.c:251 explicitly notes height
is NOT accounted. So adjacent flat labels do not grow rank height. The 4.95 is
the **bbox/translate** growing to include the down-arcs + below-rank labels
(`to1`/`to2` at y=-3.55, arcs dipping toward the baseline) that the port omits
because of Issue 2.

**Hypothesis (verify after Batch 1):** fixing Issue 2 — drawing the down-arcs and
their below-rank labels — grows the port bbox to include them and resolves the
4.95 automatically. If it does, **Batch 2 / T2 is a no-op** (document + skip). If
a residual vspace remains after Batch 1, instrument `set_ycoords` / rank `ht2`
then. This matches AD-2's stated rationale ("Issue 2 first … clarifies whether
the 5pt vspace is truly independent").

## Issue 3 (Batch 3, conditional) — x-NS tie-break

Node x deltas: 136 Δ1 (255 vs 256), 376 Δ2, 196/256/436 Δ4. C reserves slightly
more horizontal gap between adjacent labeled flats (76↔376 gap 38 C vs 36 port) —
possibly coupled to the `ED_dist` label-width reservation in the same function
family. Re-measure after Batch 1+2 (AD-3): fix only if localized + low-risk.
