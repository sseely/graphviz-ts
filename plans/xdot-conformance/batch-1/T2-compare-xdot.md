# T2 — compare-xdot.ts (semantic comparator)

## Context
The SVG comparator `test/golden/compare.ts` walks a normalized SVG tree and flags
a numeric diff only when `|actual - expected| > tolerance` (0.01 for dot). We need
the xdot analogue. xdot output is **DOT syntax** carrying draw-op attribute
strings (`_draw_`, `_ldraw_`, `_hdraw_`, `_gdraw_`, `_tdraw_`). A ready-made
parser exists: `src/xdot/parseXDot(str) -> { ops: XdotOp[] } | null` with typed
ops in `src/xdot/types.ts`.

## Task
Create `test/golden/compare-xdot.ts` exporting
`compareXdot(actual: string, expected: string, tolerance = 0.01): XdotDiff[]`
(empty array = conformant). Also create `compare-xdot.test.ts`.

Algorithm:
1. Parse each side's xdot text with `parse` (`src/parser`) into a Graph, OR do a
   light structural extraction — you need, per object, the raw draw-attr strings
   and `pos/bb/width/height`. Key objects by: graph = `"$graph"`, node = node
   name, edge = `"<tail>-><head>"` (or `--` for undirected; use the connector).
   If the same edge key repeats (parallel edges), index by order of appearance.
2. For each object present in either side, for each draw key
   (`_draw_/_ldraw_/_hdraw_/_gdraw_/_tdraw_`): `parseXDot` both strings into
   `XdotOp[]` and compare:
   - **Opcode sequence must match exactly** (same kinds in the same order). A
     missing/extra op is a structural diff.
   - **Numbers** (coords, radii, widths, point lists) compared at `tolerance`.
   - **Colors** canonicalized before compare: lower-case hex; map named colors
     (`black`→`#000000`, `red`→`#ff0000`, `white`→`#ffffff`, `none`/`#…00`
     transparent) via a small table; treat `#rrggbb` and `#rrggbbaa` with `aa=ff`
     as equal. Reuse any existing color canon in `src/` if present (grep
     `canonicalizeColor`/`resolveColor` first — do not duplicate).
   - **Font names** canonicalized: `Times,serif` ≡ `Times-Roman`,
     `Helvetica,sans-Serif` ≡ `Helvetica`, etc. Provide a minimal alias table
     covering the corpus's default fonts; unknown fonts compared verbatim.
   - **Text `T` op strings** compared verbatim (the glyph string), position at
     tolerance.
3. Compare `pos/bb/width/height` numerically at tolerance.
4. **Ignore** everything else: attribute ordering, number formatting, quoting,
   the `node [label="\N"]` default line, `xdotversion`.

Each `XdotDiff` records `{ object, drawKey, opIndex, field, actual, expected,
delta? }` — enough for the walker to print a precise, human-readable divergence.

## Read-set
- `test/golden/compare.ts:1-120` (tolerance tables, numeric-diff shape, Diff type)
- `src/xdot/index.ts` (`parseXDot` export) and `src/xdot/types.ts` (`XdotOp` union)
- `src/render/xdot-public.ts:75-92` (how ops are collected per attr — reuse the
  `appendAttrsOps` pattern)
- grep `src/` for existing color/font canonicalization before writing your own

## Interface contract (consumed by T3)
```ts
export interface XdotDiff {
  object: string; drawKey: string; opIndex: number;
  field: string; actual: string; expected: string; delta?: number;
}
export function compareXdot(actual: string, expected: string, tolerance?: number): XdotDiff[];
```

## Acceptance criteria (Given/When/Then)
- Given two identical xdot strings, when `compareXdot`, then `[]`.
- Given expected `e 27 90 27 18` and actual `e 27 90.005 27 18` (within 0.01),
  when compareXdot, then `[]`.
- Given expected node color op `c 7 -#ff0000` and actual `c 7 -#000000`, when
  compareXdot, then one diff with `field` naming the color and the two values.
- Given expected edge with `_draw_` (bezier) and actual edge with no `_draw_`,
  when compareXdot, then a structural diff flagging the missing op stream.
- Given actual differing only by attribute order and `width=.75` vs `0.75`, when
  compareXdot, then `[]` (formatting ignored).
- Given expected font `-Times-Roman` and actual `-Times,serif`, when compareXdot,
  then `[]` (canonical alias).

## Observability / rollback
N/A. Reversible (new files).

## Quality bar
`npx tsc --noEmit` clean; `npm test` green including `compare-xdot.test.ts` (≥6
cases above). One commit: `test(xdot): add semantic xdot comparator`.
