# G1 — multicolor parser + gradient color resolution (AD4, AD6)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
~/git/graphviz/lib (tag 15.0.0) is the spec. Vitest, strict TS, JSDoc
@see per ported block. Baseline 1584/0, 97 goldens. Hook rule: smallest
fix, ≤2 attempts/file, then move on (limits: 30 lines/fn, CCN 10, 5
params, 500 lines/file).

The parity-render-styling mission resolves solid pen/fill and falls back
to the FIRST solid color for any `"c1:c2"` spec (AD3 of that mission).
This task ports the foundation for true gradients: the shared multicolor
color-list parser (`parseSegs`) and the 2-color gradient wrapper
(`findStopColor`). It also extends the existing node/cluster fill
resolvers to return a discriminated gradient record. PURE functions only
— no rendering, no ObjState mutation (G2/G3/G4 consume this).

## Task (TDD — failing tests first)

### 1. src/common/multicolor.ts (NEW) — port parseSegs / colorsegs_t

@see lib/common/emit.c:470 `parseSegs` and the `colorseg_t`/`colorsegs_t`
types (search `typedef struct .*colorseg` near the top of emit.c). Port
a pure parser:
```ts
export interface ColorSeg { color: string | null; t: number; hasFraction: boolean; }
export function parseSegs(colorlist: string): { segs: ColorSeg[]; error: 0|1|2 };
```
Parse `"c1;f1:c2;f2:…"`: colon-separated segments, each `color` with an
optional `;fraction`. Mirror C's accounting of fractions and the
unspecified-fraction distribution (read the C carefully — segments
without an explicit fraction split the remaining weight; C returns rv>0
on malformed input). Keep the C return-code semantics (0 ok, 1/2 error
classes). This module is consumed by findStopColor (below), striped/
wedged (S1), and multicolor edges (M1) — get the shape right.

### 2. src/common/style-resolve.ts — add findStopColor + gradient resolution

- `findStopColor(colorlist: string): { fillColor: string; stopColor: string; frac: number } | null`
  @see lib/common/emit.c:4335. Calls parseSegs; returns null when
  parseSegs errors OR < 2 segments OR first color null. fillColor =
  segs[0].color; stopColor = segs[1].color ?? DEFAULT_COLOR ("black").
  frac = segs[0].hasFraction ? segs[0].t : segs[1].hasFraction ?
  (1 - segs[1].t) : 0. (>2 segments: use the first 2, like C.)
- Extend `resolveNodeFill` and `resolveClusterFill` to return a
  DISCRIMINATED fill instead of `{filled, color}`:
  ```ts
  type ResolvedFill =
    | { kind: 'none' }
    | { kind: 'solid'; color: string }
    | { kind: 'linear' | 'radial'; fillColor: string; stopColor: string; frac: number; angle: number };
  ```
  Logic (mirror poly_gencode / emit_clusters, AD6):
  - Not filled → `{kind:'none'}`.
  - Filled: take the resolved fill color string (existing precedence:
    fillcolor||color||lightgrey for nodes; the cluster precedence for
    clusters). Run findStopColor on it.
    - findStopColor null → `{kind:'solid', color}` (single color).
    - findStopColor non-null → kind is `'radial'` when the style flags
      include `radial` (parseStyleFlags), else `'linear'`; carry
      fillColor/stopColor/frac and `angle` = the `gradientangle` attr
      (int, default 0).
  - Accept the `gradientangle` attr in the attrs bag (NodeAttrs /
    ClusterAttrs gain an optional `gradientangle?: string`).
  KEEP the existing call signatures working for G3/G4; the existing
  parity tests that assert `{filled, color}` will need updating to the
  new shape — update them in this task (they are in style-resolve.test.ts
  which you own). Any OTHER caller of resolveNodeFill/resolveClusterFill
  (poly-gencode.ts, device.ts) is updated by G3 — do NOT touch those
  files; if removing the old return shape breaks tsc in files you don't
  own, keep a thin compatibility accessor OR coordinate via the interface
  contract (G3/G4 will consume the new shape). Prefer: change the return
  shape and let G3 adapt (the batch is sequenced — G3 runs after G1).
  Note: if leaving the old shape is easier for tsc, add the discriminated
  result as a NEW function (e.g. `resolveNodeFillEx`) and keep the old one
  — agent's call; document it in the journal-return.

## Write-set (STRICT)

- src/common/multicolor.ts (new) + src/common/multicolor.test.ts (new)
- src/common/style-resolve.ts + src/common/style-resolve.test.ts

Do NOT touch poly-gencode.ts / device.ts / svg-graph.ts (G3/G4 own the
call-site updates).

## Read-set

- ~/git/graphviz/lib/common/emit.c:470-545 (parseSegs + colorseg types),
  :4335-4365 (findStopColor)
- src/common/style-resolve.ts (existing resolveNodeFill/resolveClusterFill
  /parseStyleFlags — extend them), src/common/style-resolve.test.ts
- src/common/htmltable-emit-fill.ts:37-44 (parseGradientSpec — the simple
  existing 2-color split; parseSegs supersedes it for weighted lists but
  do NOT delete parseGradientSpec, other code uses it)

## Architecture decisions (locked)

AD4 (parser in multicolor.ts, built here; findStopColor in
style-resolve.ts imports it), AD6 (two-color ⇒ gradient when findStopColor
true; radial when style=radial). Pure data-in/data-out.

## Acceptance criteria (assert exact values)

- `parseSegs("red:blue")` → 2 segs, colors red/blue, no fractions, ok.
- `parseSegs("red;0.3:blue")` → seg0 {color:red, t:0.3, hasFraction:true}.
- `findStopColor("red:blue")` → {fillColor:"red", stopColor:"blue", frac:0}.
- `findStopColor("red;0.25:blue")` → frac 0.25.
- `findStopColor("red")` → null (single color, not a gradient).
- `resolveNodeFill({style:"filled", fillcolor:"red:blue"})` →
  {kind:"linear", fillColor:"red", stopColor:"blue", frac:0, angle:0}.
- `resolveNodeFill({style:"radial,filled", fillcolor:"red:blue"})` →
  {kind:"radial", ...}.
- `resolveNodeFill({style:"filled", fillcolor:"red"})` → {kind:"solid",
  color:"red"} (single color unchanged).
- Suite 0 failed; this module has no live importer until G3/G4 (97
  goldens byte-identical trivially).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed (≥1584). No `any` except
documented C-interop. EPL-2.0 SPDX header on new files. Commit
(orchestrator): `feat(G1): port multicolor parser and gradient resolution`.

## Return (brief, structured)

- parseSegs return shape + the C fraction-distribution rule you ported.
- findStopColor signature; the discriminated ResolvedFill shape; whether
  you changed resolveNodeFill/resolveClusterFill in place or added an Ex
  variant (and why).
- tsc result; scoped + full vitest pass/fail.
