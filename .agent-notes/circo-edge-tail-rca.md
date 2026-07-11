# Circo/twopi edge-routing tail — RCA (2026-07-11)

Diagnosis of the deterministic circo/twopi edge divergences that survived the
legal.c (Plegal_arrangement) port. Six ids, **five distinct mechanisms**. Node
positions were verified bit-identical to the oracle for every id (0 node-pos
diffs; circo/twopi are deterministic) — every divergence below is post-placement
(routing or emission), not a position drift.

Oracle = `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/ghl`, `-K<engine>
-Txdot`, compared with `test/golden/compare-xdot.ts` at ±0.01.

## Per-id verdict

| id | engine | verdict | mechanism |
|----|--------|---------|-----------|
| 1856 | circo | **FIXED** | ortho router dropped compass/record port offset |
| 1990 | circo | open (real bug) | ortho maze channel/segment-assignment under circo |
| 2082 | circo | open (real bug) | ortho maze channel track-fraction under circo |
| windows-tree | circo | A9 (irreducible) | circo trig-ULP → exact-tie dyna-port side flip |
| graphs-b786 | circo | emission (fixable, deferred) | gfmt5 %.5g half-away vs C half-even |
| 241_0 | twopi | A9 (irreducible) | CDT cocircular incircle tie (sibling of accepted circo/241_0) |

---

## 1856 — FIXED (compass/record ports in ortho routing)

`splines=ortho` under circo. `tailport=s, headport=n` on every edge. All diffs
were on the Y endpoint of routed edges: e.g. edge `2->4` port y0=36 (node
centre) vs native y0=0 (south port); edge `1->2` head y5 port=36 vs native=72
(north port).

**Mechanism.** C `attachOrthoEdges` (ortho.c:1075-1076) sets the spline
endpoints as `p1 = ND_coord(tail) + ED_tail_port(e).p`, `q1 = ND_coord(head) +
ED_head_port(e).p`. The port's `buildSpline` (src/ortho/index.ts:80-87) reads
`e.tailPoint`/`e.headPoint`, falling back to the node **bb centre** when unset.
`OrthoHelper.buildEdges` (src/layout/neato/splines.ts) constructed the
`TaggedOrthoEdge` with only `tail`/`head`/`_edge` and never plumbed
`tailPoint`/`headPoint` — so every ported ortho edge started/ended at the node
centre, discarding the compass/record port offset.

**Fix.** `OrthoHelper.buildEdges` now sets
`tailPoint = tail.coord + tail_port.p`, `headPoint = head.coord + head_port.p`
(src/layout/neato/splines.ts). Using `coord` (not the bb centre) is also strictly
more faithful for asymmetric nodes (lw≠rw), matching C's `ND_coord`.

**Verification.** 1856 → conformant (0 diffs). All 17 corpus `splines=ortho`
inputs pass or are unchanged under dot (2538/2620 pre-existing, confirmed against
baseline by stash). 12/12 sampled passing circo ids unchanged. tsc clean, full
suite 2934/2934.

**Ruled out.** edgetype (=4 ORTHO, correct under circo via setEdgeType); legal
arrangement (=true, ortho router runs); node positions/sizes (bit-identical).

---

## 1990, 2082 — OPEN: ortho maze channel divergence under circo (real bug)

`splines=ortho` under circo; **no explicit ports** (so the 1856 fix does not
touch them). Both **PASS under dot layout with 0 diffs** — the ortho code is
correct; only circo's coordinate distribution triggers the divergence.

**Evidence (2082, the cleaner case — mostly track-shifts, 1 topology flip).**
- Node positions AND node boxes (`coord ± lw/rw/ht`) are bit-identical to the
  oracle (dumped both).
- Edge `02c4→2fbd`: port routes a horizontal track at y=500 (rendered 526 post-
  clip), native at y=468. Δ≈32-58pt on tracks, Δ≈50pt on vertical-track x.
- The port's channel cell for the segment is `[453.58, 545.46]`, trackNo=1,
  segListLen=**1** → htrack f=0.5 → 499.5. For native's y=468 to fall in the
  same cell it needs f≈0.157, i.e. **segListLen≈6, trackNo≈6**: native packs
  ~6 segments into that channel where the port routes 1.

**Mechanism (localized, not fully isolated).** Under circo's fan-in topology
(many workers → one `events` node) and wide circular coordinate spacing, the
port's ortho maze pipeline (partition trapezoidation → `extractHChans`/
`extractVChans` channel grouping → `assignSegs`/`assignTracks`) distributes edge
segments across channels differently from C, changing per-channel `segListLen`
and therefore the interpolated `htrack`/`vtrack` positions. 1990 additionally
shows shortest-path topology flips (native detours a chain edge far left to
x=1199.5 where the port routes straight) — the maze cell adjacency / cost tie
also diverges there.

This is a **real, deterministic bug** (30-58pt, not ULP, not ports), NOT
acceptable as irreducible. It is a dedicated-mission-sized investigation:
compare the port's `partition()` output and channel/segment assignment against C
`partition.c`/`maze.c`/`ortho.c` cell-by-cell under circo coordinates. Files:
src/ortho/{partition,maze,maze-channels,ortho-route}.ts.

**Ruled out.** node positions/boxes (bit-identical); compass ports (none);
edgetype/legal (ORTHO, true); the 1856 port-plumbing fix (independent of htrack).
The pre-graph-label-translate frame is consistent (both sides route pre-translate;
2082's 26pt label shift applies to nodes and edges alike).

---

## windows-tree — A9 (irreducible): circo trig-ULP → exact-tie dyna-port flip

`splines` unset → circo LINE routing. Record nodes with field ports
(`node2:f2 -> node8:f1`). One edge, 10 diffs. Tail endpoint matches; head endpoint
mirror-flips: native clips f1 at y=1.83 (bottom), port at y=23.97 (top),
symmetric about the field centre 12.9.

**Mechanism (controlled experiment).** `node8:f1` is a middle field whose only
exposed sides are TOP|BOTTOM, so its dyna port resolves via `closestSide`
(splines-path-shared.ts) picking the face nearest the tail `node2`. The port's
post-layout coordinates:

```
node2 coord.y = 18.0000000000000320
node8 coord.y = 18.0000000000000000   (Δ = 3.2e-14)
```

The true value is 18.0 for both (a symmetric circo tree). V8's circo trig
arithmetic lands node2 a single ULP above node8; Apple libm lands it ≤ node8. At
this exact-tie, closestSide's strict `d < mind` keeps BOTTOM on a true tie
(native) but the port's ULP-positive node2 makes TOP strictly closer → 'n'. The
head port flips to the top of f1 and the straight edge clips mirror-image.

Irreducible libm portability (sibling of A3/A9): matching requires reproducing
Apple libm's `sin`/`cos` rounding in JS. **Proposed acceptance: A9**, circo
`windows-tree`, bound "10 draw-op diffs on edge node2:f2->node8:f1; head port
TOP/BOTTOM flip, bezier[5] 20.77 vs 5.03".

**Ruled out.** node positions (match to display precision); a real closestSide
sign bug (the tiebreak is correct — the input y-delta is pure FP noise around a
symmetric value).

---

## graphs-b786 — emission rounding (fixable, deferred): gfmt5 half-away vs half-even

`splines` unset → circo LINE. One edge (`n6:f2 -> n13:f1`), 2 diffs, both on the
`pos` attribute: pos[2]/[4] port "1399.3" vs native "1399.2".

**Mechanism.** The routed geometry is **bit-identical**: both `_draw_` beziers
read `B 4 1399.25 670.5 …`. The value 1399.25 is exactly representable (1399 +
2⁻²). The DOT `pos` attribute is written with C `%.5g` (5 sig-figs). C's printf
rounds the exact-halfway 1399.25 **half-to-even → 1399.2**; the port's `gfmt5`
(src/render/dot.ts:342) uses `v.toPrecision(5)`, which rounds **half-away →
1399.3**.

The codebase already has `toFixed2HalfEven` for the `_draw_` path (dot.ts:142-145,
same C-printf-rounding concern) — `gfmt5` was never given the equivalent for the
sig-fig `%.5g` case.

**Fixable but deferred.** The fix (half-even %.5g) is localized to `gfmt5` but its
blast radius is every coordinate in every graph's `pos`/`bb`/`width`/`height`; a
subtly-wrong sig-fig half-even implementation risks a corpus-wide regression, so
it warrants its own careful full-sweep PR rather than a diagnosis-session edit.
Effectively sub-tolerance (display-only, geometry identical). If accepted instead:
A8-adjacent (printf rounding), bound "2 pos-attr diffs, exact-halfway 1399.25
rounds half-away vs C half-even; _draw_ geometry bit-identical".

**Ruled out.** layout/routing (geometry bit-identical); the 1856 fix (LINE path,
untouched).

---

## 241_0 (twopi) — A9 (irreducible): CDT cocircular incircle tie

`splines=true` under twopi; compass ports (`1:se -> 6:sw`, etc.). 6 diffs on edge
`1->6`: ptCount 14 (port) vs 8 (native); all coordinate deltas < 0.07pt;
endpoints match to 0.001.

**Mechanism.** Exactly docs/known-divergences.md §A9: V8 `Math.sin`/`Math.cos`
differ from Apple libm by 1 ULP at the 8-gon obstacle corners → the constrained-
Delaunay incircle predicate sits on a knife edge for the symmetric twopi ring →
the corridor that fails `Pshortestpath` in the oracle (plain-spline fallback,
8pts) succeeds in the port (multispline, 14pts). This is the **twopi track** of
the same mechanism already accepted for the **circo** track of 241_0
(accepted-divergences-engines.json → circo/241_0, A9, edge 1->2). The known-
divergences §A9 text already names "241_0 (circo … / twopi canvas Δ≈9 via the
corridor flip)".

**Proposed acceptance: A9**, twopi `241_0`, bound "6 draw-op diffs on edge 1->6;
unfilled_bezier[ptCount] 14 vs 8, all coord deltas < 0.07pt (multispline corridor
flip)", ref known-divergences.md#a9-engine-track-twopi-circo.

**Ruled out.** node positions (bit-identical); a fixable corridor bug (the CDT is
exonerated by the standalone-GTS harness cited in §A9; the residual is the trig
ULP).

---

## Summary of proposed accepted-divergence entries (out of this task's write-set)

To be applied by the maintainer to `test/corpus/accepted-divergences-engines.json`
(+ prose already present or to add in docs/known-divergences.md §A9):

- twopi `241_0` → A9 (edge 1->6, ptCount 14v8, deltas <0.07pt)
- circo `windows-tree` → A9 (dyna-port TOP/BOTTOM flip from circo trig ULP)
- circo `graphs-b786` → A8-adjacent OR fix gfmt5 half-even (geometry identical;
  pos-attr printf-rounding tie)

Still open as real bugs (need dedicated work, not acceptance):
- circo `1990`, `2082` → ortho maze channel/segment-assignment divergence under
  circo coordinates.
