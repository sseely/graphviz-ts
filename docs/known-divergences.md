<!-- SPDX-License-Identifier: EPL-2.0 -->

# Known divergences from C Graphviz

graphviz-ts aims for **bit-for-bit fidelity** to the canonical C implementation.
The C source is the specification; an unlisted difference is treated as a defect,
not accepted behavior.

Where the output *does* differ, it falls into exactly one of three classes:

1. **Accepted deltas** — differences we have investigated, understand to the root
   cause, and have **deliberately chosen not to byte-match**. Each is bounded,
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
prose sections below (A1/A2/A3) explain each entry; a CI test
(`accepted-divergences.test.ts`) enforces that every accepted graph still
diverges, so this list cannot silently rot.

---

## Accepted deltas (we deliberately do not byte-match)

We accept a delta — rather than chase byte-parity — only when **all** of the
following hold:

- The root cause is a **portability constraint** (something the JavaScript/
  browser runtime cannot reproduce exactly), not a logic error in the port.
- The difference is **sub-perceptual** and provably **bounded**.
- A fix would have **disproportionate cost and blast radius** relative to the
  reward (typically: it would touch a shared primitive used by hundreds of
  already-byte-matched graphs, risking regressions for a fraction-of-a-pixel
  gain).

When we accept a delta we characterize it here so consumers are never surprised.
Graphs affected by an accepted delta are validated against a **structural /
tolerance** bar instead of a byte bar.

### A1. Floating-point determinism (force-directed engines)

**Affected:** `neato`, `fdp`, `sfdp`, `circo`, `twopi`, `osage` (the iterative,
spring-model engines). The `dot` engine's *layout* is **not** affected by this
iterative-model determinism; a separate, narrowly-bounded `dot` spline-routing
floating-point delta is covered in **A3** below.

**Characterization.** These engines run iterative numerical layouts whose results
depend on floating-point rounding — specifically fused multiply-add (FMA) and
`Math.pow`, which can differ across JavaScript engines and CPU architectures. The
port matches C's operation order where it can (`src/common/fma.ts`,
`src/common/arm-pow.ts`), but exact, byte-identical reproduction of these layouts
is **not guaranteed cross-platform**. The divergence is in fine node coordinates;
topology is preserved and positions agree within a small epsilon.

**Why accepted.** This is a hard constraint of running in JS, not a design choice.
There is no way to guarantee bit-identical transcendental/FMA results across all
target runtimes, so a byte bar would be untestable rather than merely expensive.

### A2. Text measurement (font metrics) → label-driven layout

**Affected:** Graphs with **wide text labels** whose measured width happens to
tip an integer-rounding boundary inside layout. Most labels are unaffected;
short labels and many long ones still match exactly. Observed example:
`proc3d` (a label-heavy graph that stays at *structural-match*); `NaN`
(`graphs-NaN` / `share-NaN` / `windows-NaN`, see below — the one case where the
shift tips a verdict to *diverged*).

**`NaN` under `ratio=compress` — same cause, amplified to `diverged`.** The
`NaN.gv` family (`orientation=landscape; ratio=compress; size="16,10"`) is an A2
case whose verdict lands at *diverged* rather than *structural-match*. The
compress x-network-simplex path is faithful — every constraint input matches C
(width-constraint value, `containNodes` minlens, aux-edge counts 471/wt 1612,
`lrBalance`, and rank orders all identical) *except* the half-widths of 9 nodes,
which the measurer reports 0.5–1.03 pt wider than C. `ratio=compress`'s
weight-1000 packing makes the normally-slack left-to-right separation
constraints **binding**, so that sub-pixel width error — invisible without
compress — surfaces as a −3..−5 pt interior x-shift. That shift tips the
`Target<->TThread` straight spline 0.55 pt past a node-box wall, so the router
bends it into an extra bezier piece (7 pts vs C's 4) — a *structural* delta,
hence *diverged*. Forcing the 9 widths to C's values reproduces C exactly
(node-x 53/76→0/76 off; spline 7→4 pts), confirming the residual is 100%
upstream font metrics, not the compress or spline code. Full evidence (with a
visual golden-vs-ours side-by-side + the 4-vs-7-point spline delta overlay):
`plans/fix-compress-xcoord/comparisons/nan-compress-xcoord.html` (prose writeup:
`…/nan-compress-xcoord.md`).

**Characterization.** Native Graphviz measures text with FreeType/libgd glyph
advances. The port uses its own font-metric model (it cannot bundle a font
rasterizer and remain browser-portable). For most strings the two agree exactly;
for some, they differ by a **fraction of a point**. Measured example —
Times-Roman 14 pt, the string `"/home/ek/work/src/lefty/lefty.c"` (31 chars):

| | width |
|---|---|
| native C | 176.00 pt |
| graphviz-ts | 176.75 pt |
| delta | **+0.75 pt (+0.43%)** |

The same node's other label line, `"93736-32246"`, measures **identically**
(96.00 pt both) — so the error is string-dependent and accumulates per glyph,
not a uniform scale factor.

**Isolating the algorithm from the font backend — the injectable `TextMeasurer`.**
A2 is only *diagnosable* — and provably distinct from a layout bug — because text
measurement is a deliberate **seam**, not hard-wired into either engine. Both
sides are driven through the **same estimation algorithm**, which holds the font
backend fixed so the parity survey measures the *layout*, not the rasterizer:

- **C side (the oracle).** The native `dot` oracle runs under a headless
  `GVBINDIR` (`test/corpus/gen-headless-gvbindir.sh` → `/tmp/ghl`) that symlinks
  **only** the `core` and `dot_layout` plugins — no `gd` / `pango` / `quartz`
  text-layout plugin. With the text-layout slot empty, graphviz falls back to
  `estimate_textspan_size`, its built-in deterministic estimator: no FreeType
  rasterization, no font files, no per-platform variance. (Were the oracle left on
  the FreeType/pango path, every label would carry rasterizer- and
  platform-specific advances, and we could not separate a layout-algorithm
  divergence from a font-backend difference — the whole corpus would be noise.)
- **TS side.** `TextMeasurer` is a one-method interface
  (`measure(text, font, size, flags) → {w, h, …}`, `src/common/textmeasure.ts`)
  **dependency-injected** into every label-sizing call site — `polyInit`,
  `recordInit`, `initEdgeLabels`, and `buildNodeLabel` each take the measurer as a
  parameter; nothing measures text through a global. The Node default is
  `EstimateTextMeasurer`, a faithful port of C's `estimate_textspan_size`,
  resolved by `createMeasurer()` (`src/common/textmeasure-factory.ts`) and pinned
  for tests/CI via `setTextMeasurer(...)` or `GV_TEXT_MEASURER=estimate`.

With both engines on the *same estimate*, the only thing left that can diverge is
the estimator's own per-glyph rounding (the +0.75 pt above) — a faithful-port
residual *inside* the measurement primitive, with the entire ranking / ordering /
network-simplex / spline pipeline held identical. That is what makes the survey a
measurement of the **algorithm**: a verdict regression points at layout code, not
at a font.

**The seam also lets us *prove* a residual is 100% measurement, not algorithm.**
Because the measurer is swappable, we can take one further step and feed the port
the **exact widths C measured** (captured from the oracle), bypassing the
estimator entirely. If the layout then reproduces C **bit-for-bit**, the
divergence is provably upstream in measurement with *zero* contribution from the
code under test. The `NaN` / `ratio=compress` case above is precisely this
experiment: forcing the 9 mismeasured node half-widths to C's values collapses
node-x, the network-simplex x-assignment, and the `Target<->TThread` spline all
onto C (node-x `53/76 → 0/76` off; spline `7 → 4` points). That isolation — not a
hand-wave — is what licenses the A2 verdict.

**Downstream effect (why a 0.75 pt label delta is visible at all).** Label width
feeds node size, which feeds the layout. The chain is deterministic:

1. A wider label → a slightly wider node box (for an *ellipse* node, the width is
   further scaled by √2 to fit the text, so +0.75 pt of text → +0.53 pt of
   half-width).
2. Node half-widths set the left-to-right **separation constraints** of the
   x-coordinate **network simplex**. Those constraints are `ROUND()`-ed to
   integers; a sub-pixel width change can tip a constraint from *N* to *N+1*.
3. The network simplex then selects a different — but equally optimal — integer
   x-assignment, shifting some node x-positions by 1–2 units. Across a wide
   drawing these shifts accumulate into a few points of overall x-extent.

The **rank assignment, node ordering, edge topology, and y-coordinates are
identical** to C; only fine x-positions move. For `proc3d` the entire effect is a
**≤ 3.55 pt** difference in x-extent over a ~2620 pt drawing (**0.13%**). A visual
golden-vs-ours overlay (the green/red fringe lands almost entirely on the long
file-path oval labels) is at
`comparisons/a2-font-metrics/proc3d-a2.html`.

**Why accepted.** Byte-matching FreeType's per-glyph advances across every font
and string would require replicating its metric tables, hinting, and rounding —
large, fragile, and still not guaranteed exact. Critically, the text measurer is
a **shared primitive**: every label in the corpus flows through it. Adjusting it
to win one string risks regressing the hundreds of graphs that currently match
byte-for-byte, for a sub-perceptual reward. The affected graphs remain
structural-match, which is the correct bar for them.

> If text-metric fidelity is ever pursued as its own effort, the target is
> concrete and documented: the port over-measures some Times-Roman strings by
> ~0.4%; the work is to align per-glyph advances against the C oracle with
> corpus-wide regression validation.

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

Everything else is byte-identical — same bounding box (608×148), node positions,
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
edges, all nodes, labels, and the bounding box are byte-identical; only the
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

---

## Tracked long tail (`dot` attribute & edge-case)

At **defaults**, the `dot` engine matches the C binary byte-for-byte on the
golden corpus. The remaining differences are the **long tail of attributes and
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
certainly on the byte-exact path. If a layout looks wrong, check `PARITY.md` for
that input class — it is likely a tracked item with an oracle-pinned fix mission,
not an unknown.

> **Note on label-driven cases.** Some `dot` graphs diverge *only* because of the
> text-measurement delta (A2) — their layout logic is correct and they sit at
> structural-match. Those are accepted deltas, not long-tail bugs.

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
  byte-identical with and without the arrowhead fix — no opposing-pair merge is
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
