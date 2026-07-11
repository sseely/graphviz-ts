# RCA: shapes-family circo/osage parity divergences

## Targets (all now conformant at 0.01)
- circo `nshare-shapes_dot` (was 700 diffs), `linux.x86-shapes_dot` (666)
- osage `graphs-shapes` (292), `nshare-shapes_dot` (338), `linux.x86-shapes_dot` (351)

## Mechanism (single root cause, two contributing ULP sites)

The visible diffs are NOT shape clipping, spline routing, or legal.ts.
They are a **connected-component packing-cell SWAP**: within each component the
geometry is rigid-identical to the oracle (node deltas were exactly 0 or exactly
±(182,338)); two whole components trade grid cells.

Causal chain (circo `nshare-shapes_dot`, proven by instrumentation):
1. `poly_init` sizes each polygon node. C computes ND_ht for diamond/house/
   pentagon/invhouse/Mdiamond as **exactly 36.0**; the port produced
   **36.000000000000007105** (~1 ULP high). Proven by patching the native
   `lib/pack/pack.c` genPoly to dump raw `GD_bb` (%.20g): C `_cc_1`/`_cc_3`
   `ury = 18` exact vs port `18.0000000000000035`.
2. `lib/pack/pack.c:genPoly` computes `H = GRID(GD_bb.UR.y-GD_bb.LL.y+2*margin,
   ssize)` where `GRID = ceil(x/s)`. Component height 36 + 16(margin) = 52,
   step 26 -> 52/26 = 2.0 exactly -> ceil = 2. The port's 36.0000000000000071
   -> 52.0000000000000071/26 = 2.0000000000000003 -> **ceil = 3**.
3. `H` off by one inflates `perim = W+H` (pack.c:255/404) by 1, breaking a
   perim TIE that exists in C (`_cc_0`==`_cc_3`==33). The unstable `qsort`
   (cmpf) then orders the two components differently -> `placeGraph` puts them
   in each other's polyomino cell -> the ±(182,338) rigid swap.

The two contributing poly_init ULP sites (`src/common/poly-sizing.ts`):

**Site A — `Math.hypot` (diamond, generic n-gons).** `transformUnitVertex`
computed `r = Math.hypot(D.x, D.y)`. For the diamond top vertex
`hypot(0.35355…, 0.35355…)`: C libm `hypot = 0.5` exact, but **V8 `Math.hypot`
= 0.500000000000000111** (1 ULP high — V8's scaled algorithm is less accurate
than libm here). `Math.sqrt(D.x*D.x + D.y*D.y)` = 0.5, matching libm bit-for-bit.
D.x/D.y were already bit-identical between C and JS, so `hypot` was the sole
diverging op.

**Site B — FMA contraction (house/invhouse, distorted 5-gons).** The unit-vertex
accumulation `R.y += sidelength*sin(angle)` is contracted by clang
(`-ffp-contract`) into a single-rounding `fmadd`; two-rounding JS `+=` drifts
1 ULP, inflating the accumulated vertex y from 0.5 to 0.5+1ULP. Proven: at the
house extreme vertex, C `Ry = 0.5` exact vs JS `0.500000000000000111`, while
angle/sin/cos and the seed values were all bit-identical. `fma(sidelength,
sin(angle), R.y)` (existing `src/common/fma.ts`, Dekker two-product) reproduces
C's fmadd exactly.

## Fix
`src/common/poly-sizing.ts`:
- `transformUnitVertex`: `Math.hypot(D.x, D.y)` -> `Math.sqrt(D.x*D.x + D.y*D.y)`.
- `polygonVertices` accumulation: `R.x/R.y += sidelength*cos/sin(angle)` ->
  `fma(sidelength, cos/sin(angle), R.x/R.y)`.

Both feed the single vertex source-of-truth (`polygonVertices` -> both node
sizing and rendered vertices), so one edit fixes sizing and geometry consistently.

## Ruled out (with evidence)
- **Shape clipping / bezierClip / poly_port**: within-component geometry was
  rigid-identical; only inter-component placement differed.
- **Spline routing / legal.ts**: edges diverged by the exact same ±(182,338) as
  their endpoint nodes (rigid component translation), not routing shape.
- **Iteration-order mirror (agfstnode/ccomps)**: port component discovery order
  matched C (both index 0 = a-g, index 3 = v..2); the swap came from perim, not
  input order.
- **qsort tie-break port bug**: the port already uses `gvQsort`; the perims were
  not even tied in the port (they were mis-computed as 35/34 vs C's 34/33).
- **`skewdist = hypot(0.64,1)` (line 289)**: bit-identical across C hypot / C
  sqrt / Math.hypot / Math.sqrt — not a source.
- **Irreducible A9 libm ULP**: REFUTED. C computes exactly 18.0/36.0; both
  diverging ops are reducible (Math.hypot->sqrt matches libm; FMA is emulable).

## Verification
- 5 targets: all `pass nDiffs 0` at 0.01.
- Regression: circo 15, osage 15, dot 25 formerly-passing ids = 0 regressions;
  ALL 70 shape-reference ids under dot (every shape: box/diamond/house/pentagon/
  invhouse/Mdiamond/doublecircle/doubleoctagon/star/…) PASS.
- `tsc --noEmit` clean; 820 unit tests (common+circo+pack) pass.
- Native `lib/pack/pack.c` probe reverted; `git -C ~/git/graphviz` clean.

## polypoly-family relation verdict
`graphs-polypoly`, `share-polypoly`, `windows-polypoly` (osage/patchwork) share
the SAME mechanism family (pack-cell swap driven by a poly_init FP ULP amplified
by pack `GRID`/`ceil`). This fix PARTIALLY resolves them under osage:
diffs dropped 89->24, 106->12, 106->12. The residual is a distinct ULP site: the
polypoly nodes use `sides=0`, `distortion`, `skew`, and `peripheries=2/3`,
exercising the periphery **bisector-walk** trig and skew contractions not touched
here. Same family, NOT literally the same one-line fix — left for a follow-up per
anti-scope-creep guidance (also touches patchwork).
