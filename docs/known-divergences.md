<!-- SPDX-License-Identifier: EPL-2.0 -->

# Known divergences from C Graphviz

graphviz-ts aims for the closest possible fidelity to the canonical C
implementation. The C source is the specification; an unlisted difference is
treated as a defect, not accepted behavior.

> **What "match" means here.** The corpus parity verdict named `conformant`
> is a **tight deterministic tolerance**, *not* literal byte-for-byte SVG
> equality: numeric coordinates and paths must agree within **±0.01** and all
> non-numeric content (tags, colors, text) must be exactly equal
> (`compareSvg(…, 'deterministic')`). Throughout this document, "match" and
> "conformant" refer to that tolerance verdict. Full definition:
> [Conformance](./conformance.md).

Where the output *does* differ, it falls into exactly one of three classes:

1. **Accepted deltas** — differences we have investigated, understand to the root
   cause, and have **deliberately chosen not to make conformant**. Each is bounded,
   characterized, and justified below. These are not bugs and will not be
   "fixed" without a specific, separately-scoped reason.
2. **Tracked long tail** — known gaps that *will* be closed, each with an
   oracle-pinned fix. These live with live counts in
   [`test/corpus/PARITY-dot.md`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/PARITY-dot.md).
3. **Non-goals** — intentional scope boundaries (formats and mechanics we never
   set out to reproduce).

The authoritative, continuously-updated records are
[`PARITY-dot.md`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/PARITY-dot.md)
(per-input parity dashboard vs. native `dot`) and
[`plans/port-catalog/README.md`](https://github.com/sseely/graphviz-ts/blob/main/plans/port-catalog/README.md)
(algorithm-level port-status inventory).

The **machine-readable** source of truth for which graphs are *accepted* (class 1
below) is
[`test/corpus/accepted-divergences.json`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/accepted-divergences.json).
The tooling joins it at report time: `PARITY-dot.md` splits **accepted deltas** from
the **tracked** backlog, and the rules gate sources its allowlist from it. The
prose sections below explain each entry (A1 and A3 are live; A2 is closed and
kept as history); a CI test (`accepted-divergences.test.ts`) enforces that
every accepted graph still diverges, so this list cannot silently rot.

---

## Accepted deltas (we deliberately do not make conformant)

We accept a delta — rather than chase byte-parity — only when **all** of the
following hold:

- The root cause is a **portability constraint** (something the JavaScript/
  browser runtime cannot reproduce exactly), not a logic error in the port.
- The difference is **sub-perceptual** and provably **bounded**.
- A fix would have **disproportionate cost and blast radius** relative to the
  reward (typically: it would touch a shared primitive used by hundreds of
  already-conformant graphs, risking regressions for a fraction-of-a-pixel
  gain).

When we accept a delta we characterize it here so consumers are never surprised.
Graphs affected by an accepted delta are validated against a **structural /
tolerance** bar instead of a byte bar.

### A1. Floating-point determinism (force-directed engines)

**Affected:** `neato`, `fdp`, `sfdp`, `circo`, `twopi`, `osage` (the iterative,
spring-model engines). The `dot` engine's *layout* is **not** affected by this
iterative-model determinism; a separate, narrowly-bounded `dot` spline-routing
floating-point delta is covered in **A3** below.

> **Scope, not an observed corpus divergence.** A1 is a **prospective
> portability caveat**, not a measured divergence in the parity survey. The
> survey is **dot-engine only**: the native oracle runs under
> `GVBINDIR=/tmp/ghl`, which symlinks **only** the `core` + `dot_layout` plugins
> (`test/corpus/gen-headless-gvbindir.sh` loops over exactly `core dot_layout` —
> no `neato`/`fdp`/`circo`/`twopi`/`osage`/`sfdp` layout plugin is present), and
> both oracle and port are invoked with the `dot` engine
> (`test/corpus/survey.ts`). So the force-directed engines are **implemented**
> (`src/layout/{neato,fdp,sfdp,circo,twopi,osage}`, registered and unit-tested)
> **but never exercised by the parity dashboard** — corpus ids like `*_neato` /
> `*_circo` / `root_twopi` are *filenames* laid out with `dot`, not their native
> engine. A1 therefore matches **zero** corpus graphs today because those
> engines are unsurveyed, **not** because they are proven conformant.

**Characterization.** These engines run iterative numerical layouts whose results
depend on floating-point rounding — specifically fused multiply-add (FMA) and
`Math.pow`, which can differ across JavaScript engines and CPU architectures. The
port matches C's operation order where it can (`src/common/fma.ts`,
`src/common/arm-pow.ts`) — e.g. `sfdp` pins to ~6 significant digits against the
native oracle with a matched PRNG and `fma` — but exact, identical-coordinate
reproduction is **not guaranteed cross-platform**. Topology is preserved; the
potential divergence is in fine node coordinates.

**Why accepted.** This is a hard constraint of running in JS, not a design choice
— the same family as A3's Apple-`hypot` sensitivity. There is no way to guarantee
bit-identical transcendental/FMA results across all target runtimes, so a byte bar
would be untestable rather than merely expensive. **To actually assess A1** (as
opposed to caveat it) requires a separate force-directed parity track: a
`GVBINDIR` variant carrying the force-directed plugins, each input surveyed under
its native engine vs the port. The honest ceiling on that work is to **narrow**
A1 to "no active divergence on the reference platform," never to eliminate the
cross-platform caveat.

**Engine-track acceptance: twopi arrows family.** <a id="a1-twopi-arrows-family"></a>
The blockquote above describes the dot-engine SVG survey, where A1 matches zero
graphs; the separate `twopi` **xdot engine track** (`parity-twopi.json`, native
`dot -K twopi -Txdot` oracle, `test/corpus/engine-walk.ts`) *does* run under its
native engine and surfaces a concrete, verified A1 instance on 8 corpus ids:
`graphs-arrows`, `graphs-newarrows`, `graphs-arrowsize`, `linux.x86-arrows_dot`,
`macosx-arrows_dot`, `nshare-arrows_dot`, `share-newarrows`, `windows-newarrows`
— each diverging on a single dominant edge (`Z->I` or `i->Z`; 12–64 draw-op
diffs). Injection A/B (decision journal, 2026-07-10 "injection A/B verdicts:
twopi arrows family EXONERATED..." entry) proved the mechanism directly:
dumping native `spline_edges`'s entry `ND_pos` and injecting it into the
port's `splineEdgesShifted` produces **fully conformant** output on
`graphs-arrows` (`Z->I` becomes byte-identical to the oracle, same 7/14-point
spline) — so the divergence is 100% pre-routing node-position drift out of
`twopi`'s PRISM overlap-removal solver, and the port's spline routing/emission
is exonerated. The visible symptom on 6 of the 8 ids is a bezier point-count
flip (`unfilled_bezier[ptCount]: 8 vs 14`): `Proutespline`'s fitted piece count
is sensitive to which side of an obstacle boundary the drifted node position
lands on, so a sub-ULP position difference downstream of PRISM's iterative
solve flips the fitted spline's segment count (the other 2 ids,
`graphs-arrowsize`/`nshare-arrows_dot`, show the same drift as a smaller
position-only delta with no piece-count flip). Accepted at the engine-track
level via `test/corpus/accepted-divergences-engines.json`, joined into
`PARITY-twopi.md` by `parity-report.ts` — the same join `accepted.ts` performs
for the dot-track `PARITY-dot.md`.

`1855` is the radial/star **mirror** variant of the same pre-routing PRISM FP
mechanism (accepted 2026-07-11): its 31 leaves are exactly cocircular, so the
star layout is reflection-symmetric and PRISM's overlap removal sits on a
symmetry-unstable equilibrium; a 1-ULP V8-vs-libm `cos`/`sin` difference at 5
leaf angles in `circleLayout`'s `setAbsolutePos` selects the opposite mirror
basin, and the whole radial layout lands as the exact x-axis mirror of the
oracle's (max node displacement 6.04pt, bb preserved). Injection A/B proved
both directions: feeding C's exact `circleLayout` positions into the port's
PRISM reproduces the oracle node-for-node (3e-14), and restoring only the 5
ULP-divergent leaf positions flips the entire layout back to the port's
mirror. Full RCA: `.agent-notes/twopi-radial-drift-rca.md` (decision journal
2026-07-11).

### A2. Text measurement (font metrics) → label-driven layout — CLOSED

**Status (2026-07-01): closed.** No corpus id is accepted under this class
any more; the section is retained as historical documentation of the
mechanism and of the injectable-`TextMeasurer` seam that neutralized it.
Successive text-measurement fixes (the `EstimateTextMeasurer` cutover,
font-aware vertical metrics, the non-ASCII UTF-8-byte fix) resolved nearly
every label-driven layout divergence that used to live here. **`proc3d`** —
the former canonical A2 example — is fully **`conformant`** on all three
corpus dirs (`graphs-`/`share-`/`windows-proc3d`): matching bbox, zero
path-data diffs, zero label-anchor diffs.

**The last members retired (2026-07-01).** The **`NaN` family**
(`graphs-NaN` / `share-NaN` / `windows-NaN`) was carried here long after its
node geometry already matched C exactly (76/76 reference points). Its real
residual — 8 straight-edge endpoints on four opposing 2-cycle pairs
(`Target↔TThread`, `Interp↔InterpF`, `Event↔Target`,
`AtomProperties↔NRAtom`) shifted 6–14 pt — was re-diagnosed and turned out
to be **no font-metric effect at all**, but two port defects in dot's
multi-edge routing (mission `plans/fix-nan-a2-retire/`,
`.agent-notes/nan-edge-endpoint-diagnosis.md`):

1. **Opposing-pair lane order.** The port re-sorted each parallel-edge
   group by original creation seq before assigning Multisep lane offsets; C
   assigns lanes in the edgecmp collected order (MAINGRAPH forward rep
   first, AUXGRAPH reversed member second — `dotsplines.c:419`,
   `make_regular_edge:1885-1907`). A 2-cycle whose reversed member was
   declared first drew each edge on the other's 18 pt corridor.
2. **Spurious flat-adjacency on cross-rank merged edges.** `markAdjacent`
   marked `ND_other` entries without C's same-rank guard
   (`flat.c:272-276`), letting `groupSize`'s flat-adjacent short-circuit
   swallow portcmp group breaks.

With both fixed faithfully, the family is **`conformant`** on all three
dirs (per-element: nodes 0, edges 0 differing), and the same mechanism
closed `42`, `clust2`, `ngk10_4` (structural-match → conformant) and moved
`b124` from diverged to structural-match — all on 2-cycle/parallel pairs.

**Both survey sides run the same estimator — measurement is neutralized.**
The native `dot` oracle runs under a headless `GVBINDIR`
(`test/corpus/gen-headless-gvbindir.sh` → `/tmp/ghl`) that symlinks only the
`core` and `dot_layout` plugins — no `gd`/`pango`/`quartz` text-layout plugin.
With that slot empty, graphviz falls back to its built-in
`estimate_textspan_size`. The TypeScript port's `EstimateTextMeasurer`
(`src/common/textmeasure.ts`) is a faithful port of the same routine and is
the Node default, resolved by `createMeasurer()`
(`src/common/textmeasure-factory.ts`). **Both sides of every parity
comparison therefore measure text with the identical estimator** — real
FreeType/pango glyph advances never enter the comparison. This is why a
verdict regression here points at layout code, not at a font, and it is why
fixing the estimator's own bugs (UTF-8 byte counting, vertical-metric
font-awareness) closed most of this class outright rather than merely
narrowing a font-metric gap.

**The injectable `TextMeasurer` seam.** This neutralization is only possible
because text measurement is a deliberate seam, not hard-wired into either
engine. `TextMeasurer` is a one-method interface (`measure(text, font, size,
flags) → {w, h, …}`) dependency-injected into every label-sizing call site —
`polyInit`, `recordInit`, `initEdgeLabels`, and `buildNodeLabel` each take the
measurer as a parameter; nothing measures text through a global. It is
pinned for tests/CI via `setTextMeasurer(...)` or `GV_TEXT_MEASURER=estimate`.
The seam also lets a residual be *proven* measurement-only: feed the port the
exact widths C measured (captured from the oracle) and check whether layout
then reproduces C exactly. That experiment is what originally licensed the
A2 verdict for `proc3d` (see the historical appendix below) — the technique
remains valid. Its inverse retired the class: because measurement was
provably neutralized on both survey sides, the `NaN` edge residual could not
be a font-metric effect, which forced the re-diagnosis that found the two
routing defects above.

::: details Historical analysis (superseded 2026-06-30) — retained for the record
The material below describes an earlier state of this class, before the
`EstimateTextMeasurer` cutover, font-aware vertical metrics, and the
non-ASCII UTF-8-byte fix closed most of it. It no longer describes current
behavior — kept only so the reasoning that led here is not lost. In
particular: (1) the "native C" width numbers in the measurement table below
are **FreeType** values from a real-font rendering path; the parity survey
never exercises that path — both sides run `estimate_textspan_size` (see
above) — so the table does not reflect how parity is currently measured; (2)
the overlay figures and golden/ours renders below depict a **non-corpus**
`proc3d` (`graphs/directed/proc3d.gv`, ~2620 pt) that is not part of the
parity survey; the corpus `proc3d` variants are now conformant with zero
diffs, so there is no overlay to show for them; (3) the `NaN`/`ratio=compress`
node-x narrative below is superseded — current measurement shows all 76 node
points match exactly, so the width-error → node-shift chain it describes no
longer holds for `NaN`.

**`NaN` under `ratio=compress` (historical).** The
`NaN.gv` family (`orientation=landscape; ratio=compress; size="16,10"`) was an
A2 case whose verdict at the time landed at *diverged* rather than
*structural-match*. The compress x-network-simplex path was faithful — every
constraint input matched C (width-constraint value, `containNodes` minlens,
aux-edge counts 471/wt 1612, `lrBalance`, and rank orders all identical)
*except* the half-widths of 9 nodes, which the measurer reported 0.5–1.03 pt
wider than C. `ratio=compress`'s weight-1000 packing made the normally-slack
left-to-right separation constraints **binding**, so that sub-pixel width
error — invisible without compress — surfaced as a −3..−5 pt interior
x-shift. That shift tipped the `Target<->TThread` straight spline 0.55 pt
past a node-box wall, so the router bent it into an extra bezier piece (7
pts vs C's 4) — a *structural* delta, hence *diverged*. Forcing the 9 widths
to C's values reproduced C exactly (node-x 53/76→0/76 off; spline 7→4 pts),
confirming the residual was 100% upstream font metrics, not the compress or
spline code, **for that former divergence**. Full evidence (with a visual
golden-vs-ours side-by-side + the 4-vs-7-point spline delta overlay):
`plans/fix-compress-xcoord/comparisons/nan-compress-xcoord.html` (prose
writeup: `…/nan-compress-xcoord.md`).

**Font-metric measurement example (historical — FreeType vs estimate).**
Native Graphviz, when run with a real text-layout plugin (not the headless
oracle used by the parity survey), measures text with FreeType/libgd glyph
advances. The port's `EstimateTextMeasurer` does not replicate a glyph
rasterizer. For most strings the two agree exactly; for some, they differ by
a fraction of a point. Measured example — Times-Roman 14 pt, the string
`"/home/ek/work/src/lefty/lefty.c"` (31 chars):

| | width |
|---|---|
| native C (FreeType) | 176.00 pt |
| graphviz-ts (estimate) | 176.75 pt |
| delta | **+0.75 pt (+0.43%)** |

The same node's other label line, `"93736-32246"`, measured **identically**
(96.00 pt both) — the error is string-dependent and accumulates per glyph,
not a uniform scale factor. This FreeType-vs-estimate gap is real but is
**not** what the parity survey measures (both sides run `estimate`); it would
only matter if graphviz-ts output were compared against a real-font C
rendering outside this survey.

**Downstream effect on the former `proc3d` divergence (historical).** Label
width feeds node size, which feeds layout:

1. A wider label → a slightly wider node box (for an *ellipse* node, width is
   further scaled by √2, so +0.75 pt of text → +0.53 pt of half-width).
2. Node half-widths set the left-to-right separation constraints of the
   x-coordinate network simplex; those constraints are `ROUND()`-ed to
   integers, so a sub-pixel width change can tip a constraint from *N* to
   *N+1*.
3. The network simplex then selects a different — but equally optimal —
   integer x-assignment, shifting some node x-positions by 1–2 units.

For the non-corpus `proc3d.gv` (`graphs/directed/proc3d.gv`, ~2620 pt, not a
parity-survey member), that produced a **≤ 3.55 pt** difference in x-extent
(**0.13%**), overlaid below — **green = native C `dot` (golden), red =
graphviz-ts (ours)**:

![proc3d golden-vs-ours overlay: green = C, red = graphviz-ts](/img/proc3d-overlay.svg)

Zoomed in, the fringe appeared almost entirely on the long file-path oval
labels:

![proc3d overlay, zoomed on the wide path-label ovals: green = C, red = graphviz-ts](/img/proc3d-overlay-zoom.png)

| Golden — native `dot` | Ours — graphviz-ts |
|---|---|
| ![proc3d rendered by C Graphviz](/img/proc3d-golden.svg) | ![proc3d rendered by graphviz-ts](/img/proc3d-ours.svg) |

The standalone write-up (root cause, per-metric numbers, reproduce command)
is on its own page:
[**proc3d — the canonical A2 font-metric divergence (historical)**](/divergences-proc3d-a2).
That page describes a resolved divergence on a non-corpus input; the current
corpus `proc3d` variants are conformant.

**Why this was accepted at the time.** Byte-matching FreeType's per-glyph
advances across every font and string would have required replicating its
metric tables, hinting, and rounding — large, fragile, and still not
guaranteed exact. The text measurer is a shared primitive: every label in
the corpus flows through it, so a fix aimed at one string risked regressing
others for a sub-perceptual reward.
:::

### A3. `hypot` tie-break in spline routing (`dot`)

**Affected:** `dot` graphs with a **geometrically symmetric** edge-routing
channel — typically a short, symmetric flat-edge arc. Observed example: `2368`,
which stays at *structural-match* (maxΔ ≈ 10.2 pt on **one** edge, `376->76`).
The same tie-break also surfaces on a **long** (multi-rank) edge into a
high-fan-in hub when the corridor is exactly mirror-symmetric: `graphs-b100` /
`graphs-b104` (identical source) diverge by maxΔ 20 (exactly one rank-row) on the
single knot of `Node23730->Node23729` — every node position and all upstream
box/polygon/taut-path structure is byte-identical to C; only `findMaxDev`'s
~1-ULP choice of which mirror-symmetric interior point becomes the bezier knot
differs. The short flat-edge form also surfaces as `241_1` (structural-match,
maxΔ ≈ 2.4 pt) — the divergent sibling of the oracle-pinned `241_0`, which C's
noise instead keeps-first. The same tie-break produces a labeled 2-cycle
back-edge slit-corridor split in `2413_1` (structural-match, maxΔ 67.65) and
`2413_2` (maxΔ ≤99.55 once the T11 swapBezier-reverse fix lands — until then
the file's reported maxΔ 1922.26 is dominated by an unrelated, separately-
tracked defect), and a single intra-cluster labeled edge in `graphs-decorate`
(maxΔ 43.54); in each case the two candidate split corners tie to within
5.7e-13 (2413 family) / 3e-14 (decorate) of each other before the
position-dependent Apple `hypot` noise picks a winner. `2371`
(structural-match, maxΔ 16.8) shows the same fingerprint on two unrelated
edges (`g[9263]` `r6837mid--r9687mid`, `g[23859]` `r38mid--r8699mid`): the
port emits the exact control-point-sequence mirror of the oracle on both,
knot y flipped by an identical Δ16.8 (top/bottom split fractions swapped).
Its origin is qualified **MEDIUM** confidence rather than the CONFIRMED
confidence of the other members: `2371` packs ~199 components, which
decouples pathplan-local coordinates from page coordinates, so the tie could
not be correlated live to `route.ts:209` across three instrumentation
attempts; a straight-mode-segmentation or post-clip `recover_slack` origin is
not fully excluded. Full diagnosis:
`plans/residual-cleanup/analysis/2371-mirror.md`. Most routed edges are
unaffected.

::: details Graph definition (`2368.dot`)
```dot
digraph G {
  compound=true;
  concentrate=true;
  node[shape=box,fontsize="8",color="#909090",height="0.1"];
  edge[style="dashed",fontsize="8",color="#808080",arrowsize="0.5"];
  line7[label="#7"];
  {rank=same; line7;136;}
  line7 -> 136[style=invis];
  line11[label="#11"];
  line7 -> line11[weight=100,style=invis];
  {rank=same; line11;16;}
  line11 -> 16[style=invis];
  line16[label="#16"];
  line11 -> line16[weight=100,style=invis];
  {rank=same; line16;76;376;256;196;436;316;}
  line16 -> 316[style=invis];
  316 -> 76[style=invis];
  76 -> 376[style=invis];
  376 -> 256[style=invis];
  256 -> 196[style=invis];
  196 -> 436[style=invis];
  76 -> 376[label="from1"];
  376 -> 76[label="to1"];
  16 -> 76[label="ignore"];
  196 -> 376[label="from2"];
  376 -> 196[label="to2"];
  136 -> 196[label="ignore"];
  256 -> 436[label="to2"];
  256 -> 376[label="to1"];
  256 -> 316[label="as"];
  436 -> 256[label="from2"];
  376 -> 256[label="from1"];
}
```
:::

**Characterization.** The spline fitter (`Proutespline` → `findMaxDev`,
`src/pathplan/route.ts`) splits a fitted bezier at the interior route point of
maximum deviation. When the channel is symmetric, the two candidate split points
are an **exact mathematical tie**, and the winner is then decided by ~1e-14
floating-point cancellation noise in an absolute-coordinate bezier evaluation
whose **sign depends on absolute position**.

C's deviation distance is libm `hypot`, and the macOS Apple `hypot` that
generated the oracle is a proprietary implementation that bit-matches **no**
portable `hypot` (measured against it on the graphviz coordinate regime, bit-
identical rates: V8 `Math.hypot` ≈ 63%, a correctly-rounded / Arm-style `hypot`
≈ 84%, fdlibm `hypot` ≈ 90%, `sqrt(dx²+dy²)` ≈ 94%). Because of that ULP noise
**C itself is not consistent**: it splits two *translation-congruent* arcs toward
**opposite** corners. Within `2368` the `376->76` arc is the mirror image of the
geometrically identical `256->436` arc:

```
C    376->76 : M273.31,-4.56 C268.33,-3.14 263.11,-1.9  258.11,-1.15 250.49,0     242.34,-0.98 234.83,-2.8
port 376->76 : M277.29,-4.51 C268.27,-1.69 257.65,0.32  247.89,-1.15 244.92,-1.59 241.88,-2.21 238.85,-2.94
```

The entire delta, overlaid (12× zoom on the `376->76` / `to1` arc) — **green = C
Graphviz, red = graphviz-ts**. Both are the same shallow down-arc between the
same node boundaries; they differ by ~1–2 pt at the belly (the mid bezier
control point), where C's tie broke toward the opposite corner:

![2368 376->76 arc: green = C, red = graphviz-ts](/img/2368-376to76-overlay.png)

Everything else matches within tolerance — same bounding box (608×148), node positions,
labels, arrowheads, and all other edges. The full renders are visually
indistinguishable:

| C Graphviz | graphviz-ts |
|---|---|
| ![2368 rendered by C Graphviz](/img/2368-c.png) | ![2368 rendered by graphviz-ts](/img/2368-port.png) |

The port uses a **translation-equivariant** tie-break (a true tie always resolves
to the first index), so it draws *every* such arc the same way regardless of
position — it is self-consistent, and matches C on the arcs where C's noise also
keeps-first (e.g. `256->436`, and `241_0 5:ne->8:nw`), diverging only where C's
noise flips the other way (`376->76`). Endpoints, arrowhead target, the other
edges, all nodes, labels, and the bounding box match within tolerance; only the
interior control points of the one arc move (~1–2 pt at the belly).

**Why accepted.** Apple's `hypot` is no more reproducible across JS engines and
CPUs than the FMA/`pow` of **A1** — it is the same portability constraint, just
in the `dot` spline router. Matching C's *position-dependent* choice would mean
adopting C's strict tie-break, which lives in a **shared primitive** every routed
edge flows through: doing so trades the `376->76` match for *new* mismatches on
the arcs where C lands the other way (it regresses `241_0` and a `cnt=3`
flat-edge oracle case), a net wash that also sacrifices the port's
translation-equivariance. So we keep the consistent (equivariant) router. This is
a bounded, sub-perceptual `dot` delta — not an open bug. Full investigation:
`.agent-notes/2368-residual-flat-label-ranksep.md`.

### A4. Oracle in an acknowledged-broken state (the init_rank / pathplan family)

**Affected:** `2796` (structural-match, maxΔ 49), `2471` (structural-match,
maxΔ ~9063), `1435` (diverged, maxΔ 503), `1581` (diverged, maxΔ 465). Family
members `1939` and `2825` are **conformant** and carry no entry, and `2470`
and `graphs-structs` joined them 2026-07-11 (both collapsed to conformant
after the ortho adjacency-spill/chancmpid, fmadd `polylineMidpoint`, and
half-even tie-rounding fixes landed — the port now reproduces the oracle's
recovery output exactly, including the identical lost edges); their
acceptance entries are retired.

`1581` and `2825` were crash-recovery cases (fix-element-count-bucket
mission): fuzzer/degenerate inputs where the upstream tests assert **only**
that dot does not crash (`test_1581`: no ASan violation; `test_2825`: no
crash when `rebuild_vlists` returns -1). C hits an internal `Error:`
(`install_in_rank` / `rebuild_vlists: lead is null`) and its recovery
discards layout content; the port reaches the **identical rankset-deletion
decisions** (warning parity verified: the same node/graph names in
`mark_clusters`' "already in a rankset" warnings, cluster.c:317-320).

`2825` is now fully closed. The fix-2825-rebuild-vlists mission (post-1581)
first closed the gap one layer: the port reaches C's *exact* internal-error
state — byte-identical stderr including message order
(`Error: rebuild_vlists: lead is null for rank 1` then the unprefixed
`agerr(AGPREV, ...)` continuation `concentrate=true may not work
correctly.`) — with `dotLayoutPipeline` correctly propagating
`dot_position`'s failure to skip `dot_splines`/`dotneato_postprocess`,
matching C's `dotLayout` (`if (r != 0) return r;` after `dot_position`,
dotinit.c:322-325). A follow-up (part 2) then closed the remaining
render-layer gap: C's `emit_node` gates every node on `node_in_box(n,
job->clip)` (emit.c:1806-1809), and on this abort path `job->clip` is
degenerate because `GD_bb` was never set by `set_aspect` (inside the
skipped `dot_position` tail) — so C emits *zero* nodes, only the (also
degenerate) cluster frames. The port ported that same `node_in_box` gate
(`src/gvc/device.ts:renderNode`, using `job.bb`/`job.pad` as the
single-page-equivalent of `job->clip`) and stopped recomputing a
plausible bbox from live node positions when `g.info.bb` is unset
(`src/gvc/device.ts:render`, `job.bb = g.info.bb` verbatim, mirroring
`init_gvc`'s `gvc->bb = GD_bb(g)`, emit.c:3272) — every layout engine
already sets `g.info.bb` itself before `render()` runs on every non-abort
path, so this is byte-identical on healthy graphs and only changes output
on this abort path. `2825` is now `conformant` (4-element output,
byte-identical to the oracle). See
`.agent-notes/2825-rebuild-vlists-abort.md` for the full mechanism trace
of both parts. `1581` never reaches the inconsistent state at all (a
*different* upstream cluster-window bug, not `rebuild_vlists`), so it lays
out its surviving graph in full — that gap remains open. The oracle output
on `1581` is recovery debris with no upstream-defined semantics. Evidence:
[`1581`](https://github.com/sseely/graphviz-ts/blob/main/plans/fix-element-count-bucket/comparisons/1581.md). On
every one of these inputs it is the **C oracle** that is broken, by
graphviz's own account: `2471`, `1939` and `1435` are
[`xfail(strict=True)`](https://gitlab.com/graphviz/graphviz/-/blob/9d6e3abfd2c7/tests/test_regression.py)
upstream (issues
[#2471](https://gitlab.com/graphviz/graphviz/-/issues/2471),
[#1939](https://gitlab.com/graphviz/graphviz/-/issues/1939),
[#1435](https://gitlab.com/graphviz/graphviz/-/issues/1435), cf.
[#2796](https://gitlab.com/graphviz/graphviz/-/issues/2796)); the only fix
attempt, [draft MR !4849](https://gitlab.com/graphviz/graphviz/-/merge_requests/4849),
remains an unmerged draft (last edited 2026-03-20). `graphs-structs` is the
ancient record-routing loss class (#102/#242/#274/#1323) that stable
graphviz 15.0.0 renders correctly — a dev-build oracle regression.

**What C does.** On the `init_rank` members (`2796`, `2471`, `1939`),
native dot's x-coordinate auxiliary graph closes a directed cycle through
cluster wall-constraint edges; its
[`init_rank`](https://gitlab.com/graphviz/graphviz/-/blob/9d6e3abfd2c7/lib/common/ns.c#L146)
cannot scan every node, prints `Error: trouble in init_rank`, and the
layout proceeds from that recovery state — on `2471`/`2796` ending in
`Pshortestpath` triangulation debris and lost edges. On `1435` and
`graphs-structs` the broken stage is pathplan itself (ear-clip
triangulation dead ends; a lost record-port edge).

**Inputs verified, then made faithful (this is the load-bearing part).**
The `verify-oracle-bug-family` mission
([brief](https://github.com/sseely/graphviz-ts/blob/main/plans/verify-oracle-bug-family/README.md))
dumped the constraint graph both sides feed network simplex, line-by-line,
for every family member — and found the port's earlier "clean" behavior on
this family came from **four genuine port defects**, all fixed:

1. `flatEdges` skipped C's
   [`rec_reset_vlists`](https://gitlab.com/graphviz/graphviz/-/blob/9d6e3abfd2c7/lib/dotgen/flat.c#L333)
   call, leaving cluster rank windows stale after flat-label vnode
   insertion (this alone made the port lose **9** edges on `2471` where C
   loses 6).
2. The same-`group` edge penalty fired on self-loops instead of
   same-non-empty-group endpoints
   ([`dot_init_edge`](https://gitlab.com/graphviz/graphviz/-/blob/9d6e3abfd2c7/lib/dotgen/dotinit.c#L66)).
3. `CL_CROSS` used C's `_WIN32` value 100; the oracle platform uses 1000
   ([`const.h`](https://gitlab.com/graphviz/graphviz/-/blob/9d6e3abfd2c7/lib/common/const.h#L141)).
4. A triangulation dead end aborted `Pshortestpath` instead of C's
   warn-and-continue + straight-line fallback
   ([`shortest.c:333`](https://gitlab.com/graphviz/graphviz/-/blob/9d6e3abfd2c7/lib/pathplan/shortest.c#L333)).

Post-fix, the family's NS constraint dumps are **line-identical** to C
(253 rank2 calls on `2471`; all calls on `1939`/`1435`/`graphs-structs`),
and the port follows C through the acknowledged-broken recovery: same
lost edges (`3->16` on 2796; the identical 6 on 2471), same element trees.
`1939` became fully conformant. The residual numeric deltas (and 1435's
differing pathplan debris) are behavior *inside* the recovery state, which
project policy deliberately does not chase.

**Policy note.** The earlier A4 stance ("the port meets the issue's
expectations; do not replicate") was based on the belief that the port's
acyclic aux graph came from a benign local variant. It did not — it came
from defect (1), which demonstrably mislaid `2471`. Faithfulness to the C
source won: the port now reproduces C's acknowledged-broken outcomes from
verified-identical inputs, and every entry here should be **re-measured
when upstream fixes the corresponding issue** (the oracle output will
change; expect these ids to light up as regressions at that upgrade — that
is by design, not rot).

**Evidence.** Per-id comparison pages (side-by-side renders + evidence
records):
[`2471`](https://github.com/sseely/graphviz-ts/blob/main/plans/verify-oracle-bug-family/comparisons/2471.md),
[`1939`](https://github.com/sseely/graphviz-ts/blob/main/plans/verify-oracle-bug-family/comparisons/1939.md),
[`1435`](https://github.com/sseely/graphviz-ts/blob/main/plans/verify-oracle-bug-family/comparisons/1435.md),
[`graphs-structs`](https://github.com/sseely/graphviz-ts/blob/main/plans/verify-oracle-bug-family/comparisons/graphs-structs.md),
[`2796 post-fix addendum`](https://github.com/sseely/graphviz-ts/blob/main/plans/verify-oracle-bug-family/comparisons/2796-post.md)
(pre-fix baseline preserved at
[`2796-cluster-ranking.md`](https://github.com/sseely/graphviz-ts/blob/main/plans/fix-2796-cluster-ranking/comparisons/2796-cluster-ranking.md)).
Diagnosis artifacts: `.agent-notes/2471-stale-cluster-windows-missing-reset.md`,
`.agent-notes/1939-group-penalty-clcross-misports.md`.

### A5. Invalid input bytes (encoding representation)

**Affected:** `1367` (diverged, maxΔ 0 — exactly one structural diff).

**What differs.** The input file contains a naked UTF-8 trail byte (`0x80`)
inside a node name. C treats naked trail bytes 0x80–0xBF as "valid
characters representing themselves" (`lib/common/utils.c:1200-1207`, no
warning), and node-name `<title>` text bypasses charset conversion entirely
(`agnameof` bytes flow straight to `gvputs_xml`). The oracle SVG therefore
contains the raw byte and is **not valid UTF-8** despite its declared
encoding. The port decodes invalid-UTF-8 input with the latin1 fallback
(`0x80 → U+0080`) and emits well-formed UTF-8 (`\xc2\x80`).

**Why accepted.** The port's I/O boundary is JS strings (browser library).
A raw invalid byte cannot round-trip through `renderSvg`'s string return
value; byte-matching C would mean corrupting the output encoding for every
consumer. The latin1 fallback mirrors C's own "treated as Latin-1" recovery
semantics (`utils.c:1249`). This is a constraint below the code — the
representation layer — not a portable behavior we declined to port.
Everything else in 1367 is conformant: element counts (23 polyline /
103 text / 44 polygon / 24 path) and all coordinates match after the
decorate (T6) fix.

**Evidence.**
[`1367`](https://github.com/sseely/graphviz-ts/blob/main/plans/fix-element-count-bucket/comparisons/1367.md)
comparison page (side-by-side render + evidence record).

---

### A6. `unsigned int` canvas overflow on degenerate input

**Affected:** `1314` — a fuzzer-derived input (`fontsize="991836031967s8"`)
whose absurd font size balloons the drawing to ~2.75e11 pt.

**What happens.** C stores `job->width` / `job->height` as **`unsigned int`**
(`gvcjob.h:327-328`). The `ROUND(...)` of the huge point size (`emit.c:1249-1250`)
overflows 32 bits and wraps mod 2³², and the SVG backend emits it through a
**signed** `%d` (`gvrender_core_svg.c:258-259`) — so C prints
`height="-425618343"`. The port keeps the mathematically-consistent (unwrapped)
value. Every other value — node ellipse `cx/cy/rx/ry`, the root `translate`, the
polygon, the text `font-size` — is byte-identical; only the top-level `<svg>`
width/height differ.

**Why we don't chase it.** Replicating C's 32-bit integer overflow is not a
layout behavior worth porting, and the input is degenerate. Revisit if upstream
fixes the overflow (e.g. widens the field or clamps the size).

---

### A7. `round()` box-wall rounding boundary (`dot`)

**Affected:** `graphs-honda-tokoro` (structural-match, maxΔ ≈ 1 pt on the single
edge `n012->n011`).

**What differs.** `maximal_bbox`'s head-corridor box wall lands at internal
x=90 in C versus x=89 in the port for the shared `samehead` port of the two
`n012->n011` parallels. The shared-port construction (`buildSharedPort`) and the
parallel grouping are both byte-conformant to C; the 1 px gap is purely a
`round()` rounding-boundary artifact — ~1e-14 of upstream floating-point noise
tips a value sitting exactly on a `.5` boundary to the neighbouring integer. The
port's `maximal_bbox` formula already mirrors C's exactly.

**Why we don't chase it.** `round()` is a primitive every routed edge in the
corpus flows through; nudging its boundary behaviour to match this one case is a
corpus-wide regression risk for 1 px on 2 edges — the same shared-primitive
constraint as the control-hull rounding noted in
`bbox-class-control-hull-vs-curve`. Full diagnosis:
`.agent-notes/honda-samehead-shared-port.md`.

---

### A8. `fp-contract`/FMA rounding vs. strict IEEE (`dot`)

**Class.** clang arm64 compiles the oracle binary with `-ffp-contract=on`,
fusing selected multiply-add sequences into single FMA instructions; the
port runs on V8, which performs strict IEEE-754 rounding and cannot emit
`fma`. On bit-identical inputs the two disagree by 1-2 ULP at whichever
expression the compiler chose to contract. The port side is always the
strict-IEEE-754 result; the oracle side is always the FMA-contracted
result. This is a compiler/runtime portability constraint below C
source-code semantics, not a logic defect in the port — irreducible without
emulating clang's specific contraction choices in software. Two instances
are known, at two different sites, with two different amplification
mechanisms:

- **2646** — the ULP arises inside `Proutespline`'s `points2coeff`/`solve3`
  cubic solve and directly flips a spline-fitter root count.
- **2620** — the ULP arises in `poly_init`'s polygon vertex-extent loop
  (node sizing) and is amplified downstream by `ortho`'s faithful per-relax
  int-truncation into an equal-cost maze-corridor tie flip.

**Affected:** `2646` (structural-match, maxΔ 42.09 on 3 of 21,216 edges:
`edge2575` `g[4639]`, `edge3905` `g[7777]`, `edge15467` `g[30201]` — all
record-port `:c->:nb_part` smode long-edge routes). Sibling of **A3**: both
classes are irreducible floating-point-portability ties inside
`Proutespline`, but the mechanism is distinct — a compiler `fp-contract`
artifact, not libm `hypot`.

**What differs.** On all three edges, only the final `routesplines` call (a
straight leg into the head port) diverges. Its endpoint lies bit-exactly on
the barrier polygon's bottom wall with its tangent parallel to that wall
(`evs[1]=(1,-1.22e-16)`), so every `splinefits` candidate is tangent to the
barrier at `t=1` — a near-double root of the intersection cubic.
`points2coeff` computes that cubic through catastrophic cancellation (terms
around ~7446 collapsing to ~0.099). The oracle (clang/arm64,
`-ffp-contract=on`) contracts `v3 + 3*v1 - (v0 + 3*v2)` into fused
multiply-adds, while V8 performs strict IEEE rounding — the two disagree by
~9.1e-13 on **bit-identical inputs**, and that noise flips the sign of the
`solve3` discriminant: C finds 1 root (866.7, inside the segment); the port
finds 3 roots with a spurious partner root at `t=0.9999975 < 1-EPSILON2`. The
spurious root triggers one extra `a`-halving iteration, which flips the
final piece's tangent magnitude by a factor of 2 (in either direction across
the 3 edges), producing the maxΔ 42.09 post-clip (26 SVG diffs).

**Why accepted (irreducibility proven by a controlled experiment).** All six
`routesplines` calls were dumped on both sides — box, polygon, `PL`, start,
end, and `evs` are byte-identical, as is the earlier (non-final) call's
output spline; the only divergence is inside the final call's `solve3`. A
standalone pristine-C harness isolated the single variable: compiling with
`-ffp-contract=off` reproduces the **port** bit-exactly on all 3 edges; the
default (`on`) contraction reproduces the **oracle** bit-exactly on all 3
edges. The port therefore already agrees with strict-IEEE-754 C; the
divergence is entirely the oracle compiler's FMA contraction choice, below
C source-code semantics — there is no source-level infidelity to fix. A
targeted fix (hand-emulating the contraction in `points2coeff`) was tried and
refuted: it corrects 2 of the 3 edges but not the third, whose flip
originates inside `solve3`'s own internal contraction. A complete fix would
require software-FMA emulation across the whole spline fitter — a hot-loop
cost with corpus-wide rounding blast radius for a sub-pixel, 3-edge reward.
Full diagnosis: `plans/residual-cleanup/analysis/2646-fp-contract.md`.

**Affected (historical):** `2620` (was structural-match, maxΔ 585; 423 diffs
on 24 edge paths + 22 arrowheads). **Collapsed to conformant 2026-07-11**:
the faithful `sgraph` adjacency-buffer spill + `chancmpid` bidirectional
containment port (see `.agent-notes/ortho-maze-circo-rca.md`) removed the
divergence; the acceptance entry is retired and this section is kept as
documentation of the A8 class.

**What differs.** The `ortho` (`splines=ortho`) pipeline is byte-conformant
to C given identical inputs — proven by injecting C's exact maze input
(coordinates, `xsize`/`ysize`) into the port's ortho stage: 378/378 routed
segments come out byte-identical, so nothing in `src/ortho` is at fault.
The actual divergence is 1-2 ULP in the maze *input*: node `ysize` (and, by
within-rank accumulation, `ND_coord.y`) computed in C's `poly_init`
polygon vertex-extent loop (`shapes.c`), which under
`-ffp-contract=on` fuses `R.x += sidelength*cosx` into an FMA that is ~1
ULP larger than the port's strict-IEEE arithmetic (both sides implement the
arithmetically identical expression). `2620` has 173 fractional-width
polygon nodes; all show C ≥ port by 1-2 ULP. That ULP is amplified — not
introduced — by `ortho`'s Dijkstra relax, which faithfully truncates its
running distance per-step (`sgraph.c:165`, mirrored by the port as
`Math.trunc`) over weights derived from raw cell extents
(`maze.c:257`). The ULP-shifted geometry flips an equal-cost corridor tie
for 4 routed edges (paths + their arrowheads); the remaining diffs are
±1-track renumbering knock-on from those 4 flips.

**Why accepted (irreducibility proven by a controlled experiment).** A
standalone C harness varying only `-ffp-contract` reproduced both sides on
the divergent hexagon vertex: `-ffp-contract=on` → `310.29250168188713`
(matches the oracle), `-ffp-contract=off` → `310.29250168188707` (matches
the port), with the divergent operation isolated to vertex `i=3`
(`R.x=-0.50000000000000011` fused vs. `-0.5` unfused). A second
input-injection experiment (only variable: ortho input values) confirmed
the amplifier: feeding the port's own `orthoEdges` C's exact
`coord`/`xsize`/`ysize` collapses all 4 corridor divergences to 0 — the
ortho code has no defect, it is just sensitive (as C's own maze-cost
routing is) to a 1-2 ULP shift in its input. Matching would mean emulating
clang's specific FMA contraction of one compiled expression tree in
`poly_init` — chasing a compiled artifact, not porting source semantics.
Full diagnosis: `plans/ortho-2620-residual/analysis/2620-ortho-route.md`.

**Emulated exception (not accepted): `triang.c:ccw`.** One contraction
site IS reproduced bit-for-bit rather than accepted: pathplan's `ccw`
compiles to `fnmul`+`fmadd` (exact first product − rounded second), so a
query point bit-equal to a segment endpoint tests ISCW/ISCCW instead of
ISON. `shortest.c:pointintri` then rejects polygon-vertex endpoints
("destination point not in any triangle") and `makeMultiSpline` falls back
to plain routing for every coalesced 2-cycle — a large, discrete,
corpus-wide behavior the port must match. Unlike the `solve3`/`poly_init`
sites above (deep inside compiled expression trees, fix refuted), `ccw` is
a single standalone compiled function with clean semantics, so
`src/pathplan/triang.ts` emulates it: plain-double fast path with a
conservative error bound where plain and fused signs provably agree, and
an exact Dekker-product + dyadic-BigInt path for the near-zero cases.

---

### A9. libm trig 1-ULP → CDT cocircular tie flip (`circo`/`twopi` multispline)

**Class.** V8's `Math.sin`/`Math.cos` are not bit-identical to Apple libm's
`sin`/`cos` (proven: 1-ULP disagreement at `2π·4.5/8`, one of the eight
ellipse-obstacle corner angles). `makeObstacle`'s circumscribed-8-gon corners
inherit that ULP, so the triangle router's input coordinates differ from the
oracle's by ≤6e-14. Symmetric layouts (equal-size nodes on a rank/ring) make
the router's quads **exactly cocircular** in real arithmetic, so the exact
incircle predicate sits on a knife edge: the input ULP flips its sign, the
constrained-Delaunay diagonal flips, and the corridor polygon that fails
`Pshortestpath` in the oracle ("destination point not in any triangle" →
plain-spline fallback) succeeds in the port (or vice versa). The resulting
splines differ by ~0.2–0.5pt. Sibling of **A3**/**A8**: an irreducible
floating-point portability constraint below C source semantics — matching
would require reproducing Apple libm's exact `sin`/`cos` rounding in JS.

**Affected:** `241_0` (circo Δ≈0.2 / twopi canvas Δ≈9 via the corridor flip
on edge `5:ne->8:nw`); `2343`, `2239`, `share-b29`, `windows-b29` (twopi,
1–2 edge-label position diffs each — the libm 1-ULP arises in
`poly_init`'s unit-vertex trig (`hypot`/`atan2`/`sin`), puts one node's
computed height a ULP past the min-size clamp the oracle lands on
exactly, and cascades through `floor()` in the xlabel R-tree load into a
single label-candidate flip. A correctly-rounded-hypot fix was tried and
REFUTED: it fixed `2343` but regressed `2168_3`, whose octagon sizing
flows through the same call where the oracle's value is NOT the correctly
rounded one — no deterministic hypot policy matches the oracle on both).
`2168_1` originally sat in this class but became
conformant once the port emulated the oracle's fp-contracted `ccw`
(pathplan `triang.ts`): its corridor failure is governed by the FMA'd
`pointintri` vertex-endpoint rejection, which the port now reproduces
bit-for-bit, so the CDT-diagonal ULP tie no longer surfaces there.

**Why accepted (irreducibility proven by a controlled experiment).** The
CDT itself is exonerated: the port's `mkSurface` is a faithful port of GTS
0.7.6's incremental insertion (`cdt.c`: 1→3 split + recursive
`swap_if_in_circle`, constraint edges pre-created and unswappable,
`remove_intersected_*` + `triangulate_polygon` constraint enforcement), and
a standalone C harness linking the **real GTS library** and fed the port's
bit-exact router inputs reproduces the port's triangulation face-for-face
(2168_1: 22/22; 241_0: 185/185). Exact-rational evaluation of the incircle
determinant on the two input sets confirms the sign flip (+1 with the
port's inputs, −1 with the oracle's). The residual variable — the 1-ULP
trig difference — was isolated by comparing `Math.sin`/`sin` bit patterns
directly.

**Engine-track acceptance (`accepted-divergences-engines.json`).**
<a id="a9-engine-track-twopi-circo"></a> The twopi/circo **xdot engine
tracks** (`parity-twopi.json` / `parity-circo.json`, native `dot -K <engine>
-Txdot` oracle, `test/corpus/engine-walk.ts`, semantic draw-op comparison at
±0.01 — see `test/golden/compare-xdot.ts`) surface this same mechanism
independently of the dot-engine SVG survey cited above: twopi `2239` (1
draw-op diff — the `_ldraw_` edge-label text-position flip, the same
`poly_init` unit-vertex trig ULP cascading through the `floor()` xlabel
R-tree chain; `2343`, `share-b29` and `windows-b29`, originally accepted
under this entry, were *fixed* 2026-07-11 by the faithful fmadd contraction
in `polylineMidpoint` — see the b29-family paragraph below) and circo `241_0` (41
draw-op diffs, Δ≈0.2pt on edge `1->2`'s routed bezier — the same
CDT-diagonal corridor flip; decision journal, 2026-07-10 "CDT rewritten as
faithful GTS port; 2168_3 outline-ring obstacle; 56/osage bb clobber; A9
filed" entry). Accepted at the engine-track level via
`test/corpus/accepted-divergences-engines.json`, joined into
`PARITY-twopi.md`/`PARITY-circo.md` by `parity-report.ts` — the same join
`accepted.ts` performs for the dot-track `PARITY-dot.md`.

**circo `2475_2` — cocircular closestNode hypot tie.** In one 28-node
component of this 10762-node graph, circo's `getRotation`
(`circpos.c:73-92`) picks the block node closest to the layout origin via
`hypot` to decide the sub-block's rotation. Two cocircular nodes are
effectively equidistant; V8's correctly-rounded `Math.hypot` and Apple
libm's `hypot` round that distance 2 ULP apart, which flips the strict `<`,
selects a different node, and rotates/reflects the sub-block ~20° (18 nodes
move, max 296.7pt; the other 10744 nodes are bit-identical, as are the
block tree, circle order, and every `centerAngle`). The CR-hypot policy was
already refuted for this class (2026-07-10). Standalone repro:
`.agent-notes/circo-2475-590-repro.dot`; full RCA:
`.agent-notes/circo-b81-2475-rca.md` (accepted 2026-07-11).

**b29 family (twopi).** The four b29 variants share one knife-edge: the
`EqmtTyp` edge label (`Node14732->Node14731`) sits on an exact placeLabels
side-selection tie whose outcome depends on 1-ULP twopi layout drift in the
surrounding objects. With the faithful fmadd contraction in
`polylineMidpoint` (states-family fix, 2026-07-11) the port's label anchor
is bit-identical to the oracle's, yet the tie still resolves oppositely on
two of the four variants (`graphs-b29`, `linux.i386-b29`) while the other
two (`share-b29`, `windows-b29`) now conform — and `2343`'s accepted A9
label diff cleared entirely. Bound: 1 draw-op, Δ12pt label y. Irreducible
without eliminating the upstream drift. Full RCA:
`.agent-notes/twopi-states-rca.md`.

The osage track carries the `polypoly` triple (`graphs-polypoly`,
`share-polypoly`, `windows-polypoly`; accepted 2026-07-11, full RCA in
`.agent-notes/patchwork-tail-rca.md`): the sole diverging operation is the
bare transcendental `cos(π+θ)` at a distorted-quad orientation-180 vertex —
V8's `Math.cos` is correctly rounded while Apple libm's `cos` carries a
±1-ULP argument-dependent error (so only under libm is `|cos(π+θ)| ≠
|cos(θ)|`); the 1-ULP node-size delta feeds pack's `GRID`/`ceil`, tips a
perimeter tie, and the qsort places two components in each other's packing
cells — a rigid whole-node swap with no shape or routing error. No
deterministic rewrite can reproduce a non-correctly-rounded libm
transcendental, the textbook A9 shape.

Two further engine-track instances were root-caused and accepted 2026-07-11
(full RCA: `.agent-notes/circo-edge-tail-rca.md`): twopi `241_0` (6 draw-op
diffs — the sibling of the circo entry above: the same CDT cocircular
incircle tie, flipped by libm `sin`/`cos` 1-ULP, makes the port's
multispline corridor succeed with a 14-pt spline where the native build
falls back to plain 8-pt routing; point deltas < 0.07pt) and circo
`windows-tree` (10 draw-op diffs on one fan edge — circo's placement trig
lands `node2.y` a single ULP above `node8.y` around the exactly-symmetric
value 18.0, and `closestSide`'s dyna head-port selection flips TOP/BOTTOM at
that exact tie; node positions and boxes are otherwise bit-identical to the
oracle).

---

## Tracked long tail (`dot` attribute & edge-case)

At **defaults**, the `dot` engine matches the C binary to a tight deterministic
tolerance on the golden corpus (the `conformant` verdict; see the note at the
top). The remaining differences are the **long tail of attributes and
edge cases** — the historically hard part of any Graphviz port. Unlike the
accepted deltas above, these *will* be closed; they are tracked live, with
counts, in
[`PARITY-dot.md`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/PARITY-dot.md):

| Category | What differs |
|---|---|
| **path-structure** | Edge spline routing in specific configurations (e.g. some flat-edge and dense-corridor cases). |
| **element-count** | A feature that emits extra/fewer SVG elements than C in certain graphs. |
| **color-stroke** | Stroke/fill emission differences for specific style attributes. |
| **parser-gap** | A small number of DOT inputs the parser does not yet fully accept. |

If your graph uses only common attributes and the `dot` engine, you are almost
certainly on the deterministic-tolerance match path. If a layout looks wrong, check `PARITY-dot.md` for
that input class — it is likely a tracked item with an oracle-pinned fix mission,
not an unknown.

> **Note on label-driven cases.** The text-measurement class (A2) is closed —
> no `dot` graph is accepted under it any more. A graph that sits at
> structural-match today is a tracked gap, not a font-metric delta.

### `concentrate=true` opposing-edge arrowheads

When `concentrate=true` merges an anti-parallel pair (`A->B; B->A`) into one
surviving edge, that edge must draw an arrowhead at **both** ends. This is now
ported (the `conc_opp_flag` branch of `arrow_flags`; see
`src/common/splines-clip.ts:arrowFlags`), so `graphs-b135`, `167`, and `2087`
match (the missing-arrowhead `element-count` divergence and its unclipped-spline
`@d` side effect are both gone).

Some concentrate graphs **retain a separate, pre-existing residual** that the
arrowhead fix does **not** address — it is a node **x-coordinate** position
delta (x-network-simplex / compass-port), not an arrowhead defect:

- **`graphs-b15`, `graphs-b69`** — the large record/cluster "elevator" graphs.
  Concentrate activates and merges correctly; the residual is a ~1pt node-x delta
  that amplifies into an `element-count`/spline `@d` difference. The arrowhead
  emission itself is now correct (b69 gains its missing arrowhead polygons). See
  the `b69-concentrate-undermerge` agent note for the x-coord root cause.
- **`1453`** — still diverges on a top-level `element-count` cause unrelated
  to the conc_opp_flag arrowhead.
- **`2825`** — at the time of this arrowhead fix, diverged on a top-level
  `element-count` cause unrelated to conc_opp_flag (no opposing-pair merge
  is triggered there); since closed by the fix-2825-rebuild-vlists mission,
  see A4 above.

These are tracked x-coordinate / structural items, **not** arrowhead bugs.

---

## Intentionally not ported (non-goals)

These are deliberate scope boundaries, not bugs. The library targets **SVG**
(plus the `json` / `xdot` / `dot` / imagemap intermediate text formats).

- **Other output formats.** Raster (PNG/JPG/GIF/WebP/BMP), PostScript/PDF/EPS,
  and GUI/interactive backends are out of scope. Use the SVG output and convert
  downstream if you need a raster.
- **`page=` pagination for SVG.** Native `dot` does not paginate SVG either (the
  SVG device sets no pagination flag), so `page=` is a no-op on this path in both
  implementations — documented here only because it is a common point of
  confusion.
- **`-Tplain` text output.** Deferred (a faithful text format), not excluded.
- **`gvpr`** (the graph-processing scripting language) — out of scope.
- **C++ convenience wrappers** (`cgraph++`, `gvc++`) — the C API is ported
  first; an idiomatic-TypeScript convenience layer, if wanted, would be a
  separate package.
- **Native-only mechanics** replaced by browser-safe equivalents: dynamic
  plugin loading (`dlopen`) is replaced by static engine/renderer registration;
  filesystem reads (fonts, images, config) are replaced by caller-supplied
  callbacks (e.g. `setImageSizer`). Behavior is preserved; the mechanism differs.

---

## Reporting a divergence

If you find output that differs from C and is **not** an accepted delta above,
not in `PARITY-dot.md`, and not a non-goal, that is a bug worth reporting — the C
source is the spec, and unlisted divergences are treated as defects, not
accepted behavior.
