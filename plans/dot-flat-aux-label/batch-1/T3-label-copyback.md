# T3 — DOT-10: copy the flat-edge label back from the aux graph

## Context

With T1+T2, the aux edge's label is correctly positioned. `copyOneFlatSpline`
(`splines-flat.ts`) copies the spline + arrowhead back but not the label.
C copies it (`dotsplines.c:1273-1277`).

## Task

1. Swap `copyOneFlatSpline`'s last param `bb: Box | undefined` → `g: Graph`;
   derive `const bb = g.info.bb` internally. Update the call in
   `copyFlatSplines` to pass `g`.
2. Add `copyFlatLabel(orig, auxe, del, flip, g)`: when `orig.info.label` and
   `auxe.info.label?.set`, set
   `orig.info.label.pos = transformf(auxe.info.label.pos, del, flip)`,
   `.set = true`, and `if (g.info.bb) updateBB(g, orig.info.label)`.
3. `export` the private `updateBB` in `splines-label.ts`; import it.
4. Keep each function <=30 lines / <=5 params (extract `copyFlatArrow` /
   `copyFlatLabel` helpers as in the diagnosis spike).

## Write-set

- `src/layout/dot/splines-flat.ts`
- `src/layout/dot/splines-label.ts` (export `updateBB`)
- `src/layout/dot/splines-flat.test.ts` (label oracle pin)

## Read-set

- `src/layout/dot/splines-flat.ts:199-238` (copyOneFlatSpline, copyFlatSplines)
- `src/layout/dot/splines-label.ts:288-296` (updateBB)
- `~/git/graphviz/lib/dotgen/dotsplines.c:1244-1281`
- `decisions.md#ad-3`

## Acceptance criteria

- Given `{rank=same a b} a:e->b:w[label="x"]`, when rendered, then
  `<text>x</text>` is at (72, -32.91) within 0.5pt.
- Given the same graph, when rendered, then the graph bb includes the label.
- Given `npx vitest run`, then >= 1853 pass (the T1 + T3 pins added), zero
  golden churn.

## Observability / Rollback

N/A. Reversible — revert the commit.

## Comparison page

`comparisons/dot-10-label.md`: input, oracle label (72,-32.91) + spline,
port output, byte-diff verdict. Reference in the journal.

## Commit

`feat(T3): copy flat-edge label back from aux graph (DOT-10)`
