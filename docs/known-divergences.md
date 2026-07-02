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
   [`test/corpus/PARITY.md`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/PARITY.md).
3. **Non-goals** — intentional scope boundaries (formats and mechanics we never
   set out to reproduce).

The authoritative, continuously-updated records are
[`PARITY.md`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/PARITY.md)
(per-input parity dashboard vs. native `dot`) and
[`plans/port-catalog/README.md`](https://github.com/sseely/graphviz-ts/blob/main/plans/port-catalog/README.md)
(algorithm-level port-status inventory).

The **machine-readable** source of truth for which graphs are *accepted* (class 1
below) is
[`test/corpus/accepted-divergences.json`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/accepted-divergences.json).
The tooling joins it at report time: `PARITY.md` splits **accepted deltas** from
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
Most routed edges are unaffected.

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

### A4. Oracle in an acknowledged-broken state (`trouble in init_rank`, `2796`)

**Affected:** `2796` (`rankdir=LR`, 43 clusters, 58 nodes; auto-generated
graph from the upstream report). Verdict stays **`diverged`** — but on this
input it is the **C oracle** that is broken, by graphviz's own account, not
the port.

**What C does.** Native dot builds the x-coordinate *auxiliary graph* — the
network-simplex problem whose solution assigns x positions — with a set of
cluster left/right-wall constraint edges that, on this input, **close a
directed cycle**. Its
[`init_rank`](https://gitlab.com/graphviz/graphviz/-/blob/9d6e3abfd2c7/lib/common/ns.c#L146)
topological pass then cannot scan 91 of 1362 nodes, prints
`Error: trouble in init_rank`, and the layout proceeds from that broken
recovery state: **5 pairs of overlapping clusters** (worst pair overlaps by
315×91 pt), a downstream `Pshortestpath` triangulation failure, and a lost
edge (`lost 3 16 edge`; the reporter's 14.0.5 run lost a *different* edge —
the debris is version-unstable). Exit code 1. Upstream marks this a bug:
[`test_2796` is `xfail(strict=True)`](https://gitlab.com/graphviz/graphviz/-/issues/2796)
("Graphviz should be able to triangulate the points in this graph"), the
reporter links it to
[#2471](https://gitlab.com/graphviz/graphviz/-/issues/2471), and the only
fix attempt —
[draft MR !4849](https://gitlab.com/graphviz/graphviz/-/merge_requests/4849),
which adds cycle detection to exactly this aux-edge construction — is
unmerged and performance-contested (2026-03).

**What the port does differently.** The divergence was pinned by dumping the
constraint graph both sides feed network simplex, line-by-line
(`.agent-notes/2796-ns-inputs-verification.md`):

- **Ranking is NOT the divergence.** All 44 ranking calls — each of the 43
  clusters plus the collapsed root — feed network simplex **line-identical**
  constraint graphs (2,923 edges). The port's ranks are right for the right
  reason.
- The x-aux graphs differ in ~10 of 2,904 aux edges, all `weight=0`
  cluster-wall spacers from two builders:
  [`makeLrvn`](https://github.com/sseely/graphviz-ts/blob/main/src/layout/dot/position-cluster.ts#L61)
  (two wall edges: C lengths 26 & 24.8, port 18 & 18; C ref
  [`make_lrvn`](https://gitlab.com/graphviz/graphviz/-/blob/9d6e3abfd2c7/lib/dotgen/position.c#L1052))
  and
  [`keepoutOthernodes`](https://github.com/sseely/graphviz-ts/blob/main/src/layout/dot/position-cluster.ts#L184)
  (one wall edge: C 26, port 24.8, emitted one position earlier; C ref
  [`keepout_othernodes`](https://gitlab.com/graphviz/graphviz/-/blob/9d6e3abfd2c7/lib/dotgen/position.c#L392)).
  With the port's variants the aux graph is **acyclic** (1362/1362 nodes
  scan); with C's it is cyclic. The port's
  [`initRank`](https://github.com/sseely/graphviz-ts/blob/main/src/layout/dot/ns.ts#L56)
  is the same algorithm as C's — fed a feasible problem, it simply solves it.
- Net effect: the port produces the layout the upstream issue *asks for* —
  **0 overlapping cluster pairs, all 213 edges routed, no errors** — while
  the oracle produces 212 edges with overlapping clusters, so the whole
  drawing diverges (all 58 nodes; deltas to ~724 pt).

**Why accepted rather than fixed.** Making those three wall-edge lengths
C-exact would reproduce C's cycle and therefore its acknowledged-broken
recovery layout — deliberately replicating a bug upstream intends to fix,
and unwinding whenever any form of !4849 lands. Project policy (set
2026-07-02): *never replicate C bugs the graphviz team has acknowledged but
not solved; verify our inputs, then accept with evidence.* The residual
open question — which side computes the faithful wall-edge lengths, and
whether the port's variant mislays any graph whose oracle is *clean* — is
tracked in the follow-up mission
[`plans/verify-oracle-bug-family/`](https://github.com/sseely/graphviz-ts/blob/main/plans/verify-oracle-bug-family/README.md)
together with the other diverged ids in this family (`2471`, `1939`,
`1435`, `graphs-structs` — see
[related-diverged-items](https://github.com/sseely/graphviz-ts/blob/main/plans/fix-2796-cluster-ranking/related-diverged-items.md)).

**Evidence.** Side-by-side renders, delta table, and the issue-expectations
scorecard:
[comparison page](https://github.com/sseely/graphviz-ts/blob/main/plans/fix-2796-cluster-ranking/comparisons/2796-cluster-ranking.md).
Revisit when upstream resolves #2796 (the oracle output will change; this
entry should then be re-measured rather than trusted).

---

## Tracked long tail (`dot` attribute & edge-case)

At **defaults**, the `dot` engine matches the C binary to a tight deterministic
tolerance on the golden corpus (the `conformant` verdict; see the note at the
top). The remaining differences are the **long tail of attributes and
edge cases** — the historically hard part of any Graphviz port. Unlike the
accepted deltas above, these *will* be closed; they are tracked live, with
counts, in
[`PARITY.md`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/PARITY.md):

| Category | What differs |
|---|---|
| **path-structure** | Edge spline routing in specific configurations (e.g. some flat-edge and dense-corridor cases). |
| **element-count** | A feature that emits extra/fewer SVG elements than C in certain graphs. |
| **color-stroke** | Stroke/fill emission differences for specific style attributes. |
| **parser-gap** | A small number of DOT inputs the parser does not yet fully accept. |

If your graph uses only common attributes and the `dot` engine, you are almost
certainly on the deterministic-tolerance match path. If a layout looks wrong, check `PARITY.md` for
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
- **`1453`, `2825`** — still diverge on a top-level `element-count` cause
  unrelated to the conc_opp_flag arrowhead (for `2825` the port output is
  identical with and without the arrowhead fix — no opposing-pair merge is
  triggered there).

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
not in `PARITY.md`, and not a non-goal, that is a bug worth reporting — the C
source is the spec, and unlisted divergences are treated as defects, not
accepted behavior.
