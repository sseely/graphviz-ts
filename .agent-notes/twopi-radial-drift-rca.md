# RCA — twopi 1855 residual #2: PRISM radial-layout mirror (A1, irreducible)

**Verdict:** irreducible. Accept as **A1 engine-track** (same class as the
existing twopi arrows family). No code change; the port PRISM pipeline is
bit-faithful.

## Symptom
`1855.dot` under `twopi` (`overlap=false`, star: 31 leaves → hub) diverges at
0.01: **842 xdot draw-op diffs** after the `size`-ROUND fix (mechanism #1, prior
RCA). firstDiff `edge:10->1 unfilled_bezier[0]: 397.93 vs 396.79` (Δ1.14pt). The
graph `bb` matches (`943.68,574.81` both) because the divergence is a *mirror*,
which preserves the bounding box.

## First diverging quantity
Instrumented both sides (C: printf in `circle.c:setAbsolutePos`,
`twopiinit.c` after `adjustNodes`, `delaunay.c` edge dump, `overlap.c`
per-iteration Y dump — all reverted, C tree clean, plugin rebuilt; port: gated
`globalThis.__TWOPI_DUMP`). Dumped `%.17g` per node.

| Stage | C vs port |
|-------|-----------|
| circleLayout `theta`, `span` | **bit-identical (0 ULP)** — pure +/*/÷ |
| circleLayout final `x`,`y` (= `hyp*cos/sin(theta)`) | **1 ULP at 5 nodes** (5,13,20,29,30) — the only difference is `cos`/`sin`: libm (C) vs V8 `Math.cos/sin` |
| Delaunay proximity graph (`call_tri`) | **identical edge set** (62 edges, zero diff) |
| PRISM stress iteration 0 (Y vector) | **identical to 4.9e-15** |
| PRISM stress iteration 1 (Y vector) | **sign-flips**: ΣY = C `+1.990412e-03` vs port `−1.990412e-03` (exact opposite) |
| post-`adjustNodes` final | full **x-axis mirror** (y→−y with ring relabel k↔34−k); max node displacement **0.0839 in = 6.04 pt** (nodes 3/31) |

The final layouts satisfy `port_pos(k) = y_negate(C_pos(34−k))` to ~12 digits —
i.e. the port's overlap-removed layout is the exact x-axis reflection of C's.

## Mechanism (file:line both sides)
1. `circle.ts:setAbsolutePos` L306-315 / `circle.c:setAbsolutePos` L300-304:
   `pos = (hyp*cos(theta), hyp*sin(theta))`. `theta` is bit-identical; `Math.cos`
   / `Math.sin` (V8) differ from Apple libm `cos`/`sin` by **1 ULP** at 5 of the
   31 leaf angles. This is the *only* input difference to PRISM.
2. The 31 leaves sit **exactly cocircular** on a unit circle → the star input is
   symmetric under the reflection T = (reflect y) ∘ (relabel k↔34−k). PRISM's
   overlap-removal dynamics (`overlap-prism.ts:removeOverlapPrism` /
   `overlap.c:remove_overlap`, iterative stress-majorization + Jacobi-CG) on this
   symmetric configuration sits at an **unstable / symmetry-breaking
   equilibrium**: which of the two mirror-image basins the layout falls into is
   selected by the *sign of the dominant asymmetry mode* of the input.
3. The 1-ULP `cos`/`sin` perturbation supplies that asymmetry with **opposite
   effective sign** for libm vs V8, so C and port converge to opposite mirror
   layouts. Amplification factor ≈ 1-ULP (1e-16) → 6pt (single iteration
   bifurcation, not slow drift).

## Controlled experiments (proof)
Injection A/B via `globalThis.__INJECT` (overwrite `n.info.pos` after
`circleLayout`, before `adjustNodes`):

- **A — exonerate PRISM:** inject C's bit-exact circleLayout output → port
  post-`adjustNodes` matches C to **3.2e-14 in (0.0000 pt), node-for-node**,
  node1 y correctly negative. ⇒ the port's PRISM / stress-majorization / CG /
  scan-line is **bit-faithful**; zero port bug downstream of circleLayout.
- **B — sensitivity / instability:** inject C's exact input EXCEPT restore the 5
  ULP-divergent nodes (5,13,20,29,30) to their V8 `cos/sin` values → output is
  **6.04 pt from C but 0.0000 pt from the original (mirrored) port**; node1 y =
  +0.00197 (mirror sign). ⇒ **5 single-ULP `cos/sin` differences alone flip the
  entire layout** to its mirror. This is the definition of a symmetry-unstable
  equilibrium.

## Ruled out (with evidence)
- **Port PRISM bug** — refuted by experiment A (3e-14 match on injected input).
- **Delaunay tie / cocircular-quad diagonal flip** (initial hypothesis) —
  refuted: C-vs-port Delaunay edge sets identical (62 edges, 0 diff).
- **Iteration-order / summation-order mirror** (hazard #1) — refuted: circleLayout
  theta/span 0-ULP; PRISM iteration 0 identical to 5e-15; the divergence enters
  only via `cos/sin`, and injecting C's `cos/sin` values removes it entirely.
- **circleLayout misport** — refuted: theta/span bit-identical; the only nonzero
  ULP delta is the transcendental evaluation, not the algorithm.
- **`size` ROUND (mechanism #1)** — separate, already fixed; this residual is
  independent of and prior to fill-scaling (measured pre-`_neato_set_aspect`).

## Why irreducible
The sole cause is `Math.cos`/`Math.sin` (V8) ≠ libm `cos`/`sin` at the ULP,
amplified by a genuine physical instability that C shares (C simply lands on the
other mirror). Neither layout is "more correct" — both are valid overlap-free
radial arrangements; they are reflections. Matching C would require
bit-identical, libm-compatible correctly-rounded transcendentals in the browser,
which this port has repeatedly declined (CR-`hypot` REFUTED: fixing one graph
regressed another; `cos`/`sin` are strictly harder). This is the same hard
JS-runtime constraint as A1/A3 (Apple-`hypot`/`sin` ULP), here catastrophically
amplified because the input is a regular polygon on a circle.

**Scope:** unique to highly-symmetric twopi inputs with `overlap=false` (star /
regular-polygon rings on a circle). The other listed twopi diverged ids are
different mechanisms: `2361`/`2183`/`144_ortho` = `splines=ortho` routing;
`241_0` = `splines=true`; `graphs/share/windows-states` = the known
edgeMidpoint-anchor 1-ULP (journal 2026-07-11). None share 1855's PRISM radial
mirror.

## Proposed acceptance entry (OUTSIDE this task's write-set — for orchestrator)
`test/corpus/accepted-divergences-engines.json` → `"twopi"`:
```json
"1855": {
  "class": "A1",
  "bound": "842 xdot draw-op diffs; whole radial layout is the exact x-axis mirror of the oracle's (y->-y, ring relabel k<->34-k), max node displacement 6.04pt. Mechanism: 1-ULP V8-vs-libm cos/sin in circleLayout setAbsolutePos, amplified by the symmetry-unstable PRISM overlap-removal equilibrium on the cocircular star. Injection A/B: feeding C's exact circleLayout pos into the port's PRISM reproduces the oracle node-for-node (3e-14).",
  "ref": "known-divergences.md#a1-twopi-arrows-family"
}
```
Pair with one sentence under `known-divergences.md#a1-twopi-arrows-family`
noting 1855 as the radial/star mirror variant (same pre-routing PRISM FP
mechanism; here the whole layout mirrors rather than a single edge). Regenerate
`parity-twopi.json`/`PARITY-twopi.md` (currently stale: shows pre-size-fix
firstDiff `945.31 vs 943.68`, nDiffs 871) so 1855 moves to the accepted table.

## Repro
- C dump: temporary printf in the 4 C files above, `getenv("TRI_DUMP")`/
  `getenv("PRISM_DUMP")`, rebuild `gvplugin_neato_layout`, run
  `GVBINDIR=/tmp/ghl dot -Ktwopi -Txdot tests/1855.dot`.
- Port dump / injection: `globalThis.__TWOPI_DUMP` + `globalThis.__INJECT` hooks
  in `circle.ts:circleLayout`, `pipeline.ts:layoutComponent`,
  `overlap-prism.ts` (all reverted). Driver scripts in scratchpad.
- Env note: local `~/git/graphviz` build link referenced a removed
  `glib/2.88.1`; created Cellar symlink `2.88.1 -> 2.88.2` to relink (glib was
  upgraded since the last full build). Benign, repairs the oracle rebuild.
