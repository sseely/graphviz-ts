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
spring-model engines). The `dot` engine is **not** affected.

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
short labels and many long ones still match exactly. Observed examples:
`proc3d`, `b69` (label-heavy graphs that stay at *structural-match*); `NaN`
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
**≤ 3.55 pt** difference in x-extent over a ~2620 pt drawing (**0.13%**).

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
