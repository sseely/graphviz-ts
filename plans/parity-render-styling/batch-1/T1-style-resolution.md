# T1 — style / color resolution helpers (AD2)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
~/git/graphviz/lib (tag 15.0.0) is the spec. Vitest, strict TS, JSDoc
@see per ported block. Suite baseline 1466/0, 82 goldens. Hook rule:
smallest fix, ≤2 attempts per file, then move on.

C resolves an object's drawing state from its `style`, `color`,
`fillcolor`, `bgcolor`, `penwidth`, and `gui_state` attrs before each
shape is drawn. The port has NONE of this resolution — it relies on
`emitStyle` reading a null `job.obj` (monochrome). This task ports the
pure resolution layer; T2 wires the lifecycle; T3–T5 consume it.

## Task

Create `src/common/style-resolve.ts` porting (pure, data-in/data-out):

1. `parse_style` → a `graphviz_polygon_style_t`-equivalent flag set
   (filled, dashed, dotted, bold, invis, diagonals, rounded, radial,
   striped, wedged). @see lib/common/utils.c:parse_style and
   lib/common/types.h:graphviz_polygon_style_t.
2. `stylenode`-equivalent: resolve node pen style + penwidth from the
   style flags + `penwidth` attr. @see lib/common/shapes.c (stylenode).
3. `isFilled` / `findFill`: whether a node/cluster is filled and the
   resolved fill color (style=filled → fillcolor || color || default;
   cluster style=filled → color). @see lib/common/emit.c:isFilled,
   findFill.
4. `penColor`: resolved pen color (color attr || default black).
   @see lib/common/emit.c:penColor.
5. Two-color fill spec → first solid color (AD3): REUSE
   `parseGradientSpec` from src/common/htmltable-emit-fill.ts; do not
   reimplement. Re-export or import it.

Return plain resolved values (a `ResolvedStyle` record); no rendering,
no job/ObjState mutation here (T2/T3 apply them). TDD: failing tests
first.

## Write-set (strict — nothing else)

src/common/style-resolve.ts + its co-located test file.

## Read-set

~/git/graphviz/lib/common/utils.c (parse_style);
~/git/graphviz/lib/common/shapes.c (stylenode, poly_gencode style block
~:2950-3010); ~/git/graphviz/lib/common/emit.c (isFilled, findFill,
penColor); ~/git/graphviz/lib/common/types.h
(graphviz_polygon_style_t); src/common/htmltable-emit-fill.ts
(parseGradientSpec — reuse); src/render/svg-helpers.ts:94-123
(emitStyle/emitDash/emitPenWidth — the CONSUMERS, for the value shapes
they expect: PenType, penWidth, GVColor).

## Architecture decisions (locked)

AD2 (this task — pure module), AD3 (first-color fallback, reuse
parseGradientSpec), AD4 (do not change svg-helpers emission logic).

## Interface contract (consumed by T2, T3, T4, T5)

```ts
interface PolyStyleFlags {
  filled: boolean; dashed: boolean; dotted: boolean; bold: boolean;
  invis: boolean; diagonals: boolean; rounded: boolean;
  radial: boolean; striped: boolean; wedged: boolean;
}
parseStyleFlags(style: string | undefined): PolyStyleFlags
resolvePenType(flags: PolyStyleFlags): PenType        // Solid|Dashed|Dotted
resolvePenWidth(flags: PolyStyleFlags, penwidthAttr?: string): number
resolveNodeFill(attrs): { filled: boolean; color: string } // first-solid per AD3
resolvePenColor(colorAttr?: string): string
```
Exact field names/types are the agent's call; keep it minimal and
mirror C. Document the chosen shape at the top of the file.

## Acceptance criteria

- Given `style="filled,dashed"`, when parseStyleFlags, then
  `{filled:true, dashed:true, ...rest false}`
- Given `style="filled" fillcolor="red:blue"`, when resolveNodeFill,
  then `{filled:true, color:"red"}` (first solid, AD3)
- Given no penwidth + `style="bold"`, when resolvePenWidth, then 2.0;
  given `penwidth="3"`, then 3.0 (cite the C precedence)
- Given `color="#ff0000"`, when resolvePenColor, then "#ff0000";
  absent → "black"
- Given the suite, then 0 failed (no caller wired yet → 82 goldens
  byte-identical trivially; this file has no importers until batch 2)

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; scoped vitest 0 failed. No `any` except
documented C-interop. Commit (orchestrator): `feat(T1): port style/color
resolution helpers`.
