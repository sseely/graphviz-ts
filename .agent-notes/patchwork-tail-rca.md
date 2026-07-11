# RCA: patchwork + osage residual tail (polypoly, 2717, 1898)

Three deterministic ±0.01 xdot residuals. Two fixed in `src/`, one proven
irreducible (accepted). Oracle = native `dot` @ GVBINDIR=/tmp/ghl.

---

## Item 1a — polypoly under OSAGE: IRREDUCIBLE (libm cos ULP, class A9)

Targets: `graphs-polypoly` (20 diffs), `share-polypoly` (12), `windows-polypoly`
(12), all under `-Kosage`. Unchanged by this work (poly-sizing untouched).

### Mechanism (single op, proven by instrumentation)
All diffs are a connected-component pack-cell SWAP within the `9000`-series
distorted quads (`sides=4 regular=1 distortion=.5`, orientation varied) — the
same family as the shapes-dot RCA, but a DISTINCT root op.

Instrumented native `poly_init` (temporary printf, reverted; C tree clean) and
dumped `bb`/per-vertex values %.20g. For node `9004` (orientation=180):
- C `bb.x = 57.754149262393340791`
- port `bb.x = 57.754149262393326580`  (~1.4e-14 low)

The port matches C exactly for `9000/9002/9006/9007`; only `9004` (and the
`9002` analog under share/windows) diverges. `bb.x = 2·max|Pfin.x|`, and the
diverging vertex is i=0:
- C `cosx = cos(alpha) = -0.82710402439687247256`  (alpha = π + θ ≈ 3.7384535…)
- port `Math.cos(alpha) = -0.82710402439687236154`

Controlled experiment (node, alpha bit-identical on both sides — verified
`atan2`, `sqrt(x²+y²)`==libm `hypot`, and `sin` all match bit-for-bit):
```
cos(3.7384535364844491134):  V8 = -0.82710402439687236154   (correctly rounded)
                           libm = -0.82710402439687247256   (1 ULP, arg-dependent)
cos(0.59686088289465610845): V8 =  0.82710402439687236154
                           libm =  0.82710402439687225051
```
V8's `Math.cos` is correctly rounded and returns the SAME magnitude for `cos(θ)`
and `cos(π+θ)`; Apple libm's `cos` carries a ±1 ULP argument-dependent error, so
its `|cos(π+θ)| ≠ |cos(θ)|`. That 1-ULP size delta feeds pack `GRID(size)=ceil`,
tips a perimeter tie between two components, and the qsort places them in each
other's cell (rigid ±(182,338)/±2909 translation → the 20/12/12 diffs).

### Why irreducible (no deterministic policy matches both)
The diverging op is a bare transcendental `cos(alpha)` with `alpha` bit-identical
to C. Unlike the shapes-RCA sites (`hypot→sqrt`, `+=→fma`, which recovered an
EXACT C value), there is no fma/plain-double rewrite that reproduces Apple libm's
non-correctly-rounded `cos`. Computing `-cos(θ)` instead of `cos(π+θ)` would yield
libm's `9000` value, not its `9004` value — C computes `cos(π+θ)` directly. This
is the textbook A9 class (V8 correctly-rounded vs libm not).

### Acceptance proposal
- class: **A9** (libm-vs-V8 transcendental ULP), irreducible.
- bound: ≤20 draw-op diffs per id, confined to the `9000`-series distorted-quad
  nodes; each diff is a whole-node rigid pack-cell swap (no shape/routing error).
  osage only; polypoly passes under circo/fdp/sfdp (per parity files).
- ids: `graphs-polypoly`, `share-polypoly`, `windows-polypoly` @ osage.
- registry: add under `osage` in `test/corpus/accepted-divergences-engines.json`
  (outside this task's src-only write-set — follow-up), ref
  known-divergences.md A9.

---

## Item 1b — polypoly under PATCHWORK: FIXED (box periphery winding order)

Targets: `graphs/share/windows-polypoly` @ `-Kpatchwork`, ~20 diffs each on nodes
`9012`/`9016`. Now 0 diffs.

### Mechanism
Patchwork forces `shape=box` (`patchwork_init_node`), and for a box descriptor
the `distortion`/`skew`/`sides` attrs are NOT read (only shapes with `sides==0`
read them). So the `9010–9017` nodes become plain boxes at orientation 0/45/90/…
The `9012` (orient 90) and `9016` (orient 270) boxes have CLOCKWISE vertex
winding; C's periphery bisector loop (shapes.c poly_init) then offsets each ring
INWARD (`j=0` outer, `j=1` inner), and `poly_gencode` draws `j=0…peripheries-1`
in order → OUTER-ring-first. Orientation 0/180 (CCW) offset OUTWARD → inner-first.

The port's `boxRings` (src/common/poly-vertices.ts) generated concentric rings by
FIXED insets (`inset=(peripheries-1-j)*GAP`), always innermost-first — it cannot
express the winding-dependent direction, so it drew `9012/9016`'s two rings in the
reversed order (op[1]↔op[3], delta 3.51 = GAP).

Proven: native `poly_init` ring dump (reverted) gave, per orientation:
`orient 0/180: j0=±18, j1=±22` (outward); `orient 90/270: j0=±18, j1=±14` (inward).

### Fix
`boxRings` now runs the SAME bisector walk C uses (already ported as
`polygonRingOffsets`, winding-aware): base ring = `boxVertices(base.w,base.h,orient)`,
then `j·offset`. Prototype reproduced C's dump bit-for-bit for all four
orientations. Only orient 90/270 boxes change; orient 0/180 are provably
identical to the old inset form (base 18 +GAP = node-box/2), and the no-base
(no-measurer) path keeps the inset fallback.
- file: `src/common/poly-vertices.ts` `boxRings` (+ thread `base` from
  `computeVertices`).
- C ref: lib/common/shapes.c poly_init (peripheries bisector loop) + poly_gencode.
- Ruled out: node SIZING — port `bb`/rings already matched C for 9012/9016; only
  the two rings' DRAW ORDER differed. Verified box+peripheries under dot
  (incl. orientation=90) and all `peripheries` corpus ids unchanged.

---

## Item 2 — 2717: FIXED (is_a_cluster missed cluster=true)

`2717` @ patchwork (69 diffs) AND osage (103 diffs): the `domestic_cats` subgraph
(`cluster=true`, name has no "cluster" prefix) was dropped from the treemap /
osage cluster list (`cluster:domestic_cats [missing-object]`), shifting the whole
layout.

### Mechanism
Both `src/layout/patchwork/index.ts:isCluster` and
`src/layout/osage/index.ts:isCluster` implemented ONLY the name-prefix test,
diverging from C `is_a_cluster` (lib/common/utils.c:695):
`g == g->root || !strncasecmp(name,"cluster",7) || mapbool(agget(g,"cluster"))`.

### Fix
Both `isCluster` now match `is_a_cluster` exactly (root OR case-insensitive
"cluster" prefix OR `mapbool(cluster)`). 2717 → 0 diffs under patchwork AND osage;
unaffected under dot/neato/circo/twopi (those use rank.ts `isACluster`, already
correct); fdp oracle-errors on 2717. Osage unit test updated (a non-root subgraph,
not a root, is the "false" case; added a `cluster=true` case).

---

## Item 3 — 1898: FIXED (style="invisible" alias not honored)

`1898` @ patchwork: node `N19` `_draw_`/`_ldraw_` present in port, absent in
oracle. `N19` is `shape=point style=invisible`; patchwork forces it to `shape=box`.

### Mechanism
C `gvrender_set_style` (lib/gvc/gvrender.c:497) maps BOTH `"invis"` and
`"invisible"` to `PEN_NONE`, which suppresses polygon/ellipse/textspan emission.
`emit_node`/`emit_edge`'s early return matches only the exact `"invis"` token; the
`point` shape overrides style with a `{invis,filled}` whitelist keyed on exact
`"invis"` (checkStyle), so `"invisible"` still DRAWS a point but suppresses a
box/poly. The port recognized only `"invis"` → it drew the box.

### Fix
- `src/common/style-resolve.ts`: new `styleHasInvisibleAlias(style)` (the
  `"invisible"` pen-none alias, tokenized like parseStyleFlags).
- `src/gvc/device.ts`: node early-return also fires for a NON-point node whose
  style has `"invisible"` (net xdot = C's PEN_NONE path: node present, no draw
  ops); edge early-return fires for `"invisible"` too (edges never use the point
  whitelist). Exact `"invis"` and the point shape are unchanged.
- `src/common/poly-gencode.ts`: export `isPointNode`.
Verified 1898 → 0 diffs under dot (point N19 still draws), patchwork, osage.
Regression-safe: oracle never draws a non-point "invisible" object (PEN_NONE), so
suppressing is always correct; the only corpus input with "invisible" is 1898.

---

## Verification summary
- `tsc --noEmit` clean; `npx vitest run` 2935/2935 pass (osage isCluster test
  updated + a cluster=true case added).
- Fixed ids at 0 diffs: 1898 (dot/patchwork/osage), 2717 (patchwork/osage/dot/
  neato/circo/twopi), polypoly ×3 (patchwork).
- Regression guards clean: shapes-family ×5 (circo+osage), 2168_1..5 (circo),
  box+peripheries (dot, incl. orientation=90), peripheries corpus ids (dot).
- polypoly ×3 osage: unchanged at 20/12/12 — accepted A9 (item 1a).
- Native C tree left clean (all probes reverted).
