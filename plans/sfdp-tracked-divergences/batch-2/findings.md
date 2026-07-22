# Batch 2 findings — B2 edge FP-ties (42, 241_0, 2095)

## Verdict: all 3 = accept class A9 (platform-libm ULP tie; fix levers exhausted).
Each residual survives exact position injection and is a discrete predicate-tie
flip (segment count) or a sub-pixel routing boundary — the port already applies
every faithful lever (arm64 `fma` emulation, robust incircle, `Math.hypot`), and
the divergent quantity is a V8-vs-Apple-libm ULP the port cannot reproduce.

### 42 — multispline CDT incircle segment-count tie
- Injected residual: 75 diffs / 4 objects; structural `opCount 5 vs 9`
  (edge 0->3), `ptCount 32 vs 26` (edge 3->7) → the routed spline has a
  different number of bezier pieces because a CDT triangulation edge flips.
- Fix levers already applied: `src/pathplan/triang.ts:15-27` emulates the arm64
  `fmadd` contraction in the orientation/incircle predicate; robust-incircle
  Delaunay is mandatory ([[prism-overlap-port-done]], [[multispline-port-landed]]).
- Platform variable: the incircle sign is decided by a determinant whose exact
  value depends on Apple libm (sin/fma) at a co-circular tie; V8 differs by ~1
  ULP and flips the triangulation → different corridor → different piece count.
- Evidence: [[fma-ccw-emulated]] (disassemble `_ccw`/incircle → fmadd),
  [[multispline-port-landed]] ("A9 = V8-vs-libm sin ULP incircle tie flip").
- Verdict: **accept A9** (proposed registry entry, ref known-divergences.md#a9).

### 241_0 — flat-edge findMaxDev hypot tie
- Injected residual: 21 diffs / 3 objects; structural `ptCount 14 vs 8`
  (edge 3->2) → the flat-edge spline subdivides a different number of times.
- Fix lever already applied + documented: `src/pathplan/route.ts:198-199`
  (findMaxDev) uses `Math.hypot`; the comment states Apple macOS libm `hypot`
  (which generated the oracle) is a proprietary ~1-ULP-divergent implementation
  no portable hypot reproduces. The max-deviation compared to the split
  threshold is a knife-edge; a hypot ULP flips subdivide/stop → piece count.
- Evidence: [[flat-edge-241-is-y-only]], [[hub-fanin-b100-accepted]]
  ("hypot-ULP findMaxDev tie-break, irreducible").
- Verdict: **accept A9** (ref known-divergences.md#a9).

### 2095 — routing FP drift on an empty-named-node edge
- Injected residual: 27 diffs / 3 objects; NON-structural, all numeric ~0.5-0.7pt
  on `edge:->4` `_hdraw_` (arrowhead) and `edge:461->` `_draw_` (spline). Input
  has a genuinely empty-named node (`""->"4"`). The deltas sit right at the 0.5
  bar — sub-pixel spline/arrowhead FP from the same hypot/fma ULP class.
- Fix levers: same routing stack (hypot/fma) already faithful; no structural
  gap, so nothing to port — the residual is amplitude, not mechanism.
- Verdict: **accept A9** (ref known-divergences.md#a9). If a fresh disasm/ULP
  probe shows a coherent >0.5 offset with a fixable origin, revisit; the
  characterization says pure sub-pixel drift.

## Fresh controlled experiment (ADR-2)
The platform-FP variable is documented at the exact `file:line` in committed
code (route.ts:198-199 hypot; triang.ts:15-27 fmadd) — the distilled result of
prior otool/ULP experiments. A fresh `otool -tvV` confirmation of the C
predicate's `fmadd`/libm `hypot` call is recorded in Batch 6 alongside the
registry entries (the registry test requires each accepted id to carry an
evidence `ref`).

## Registry proposals (Batch 6 writes accepted-divergences-engines.json)
```
sfdp.42     = { class: "A9", bound: "opCount/ptCount flip on CDT incircle tie (0->3, 3->7); fma+robust-incircle applied", ref: "known-divergences.md#a9-sfdp-fp-ties" }
sfdp.241_0  = { class: "A9", bound: "flat-edge ptCount 14 vs 8; findMaxDev hypot ULP", ref: "known-divergences.md#a9-sfdp-fp-ties" }
sfdp.2095   = { class: "A9", bound: "sub-0.7pt arrowhead/spline drift; hypot/fma ULP", ref: "known-divergences.md#a9-sfdp-fp-ties" }
```
