# T1 — DOT-11a: reposition aux virtual nodes via `nlist`

## Context

graphviz-ts is a faithful TS port; C at `~/git/graphviz` (15.0.0) is the
spec. `make_flat_adj_edges` (`splines-flat.ts:makeFlatAdjEdges`) lays out a
rotated aux graph then `repositionFlatAux` rotates it back. The loop
iterates `aux.auxg.nodes.values()` (named nodes only), so virtual nodes
(label vnode + routing vnodes) never get `y = midx`. C iterates
`GD_nlist`. Result: labeled-flat splines bend wrong and the label X is off.

## Task

In `repositionFlatAux`, replace the `for (const n of aux.auxg.nodes.values())`
loop with an `nlist` walk:

```ts
for (let n: Node | undefined = aux.auxg.info.nlist; n; n = n.info.next) {
  if (n === aux.auxt) n.info.coord = { x: midy, y: rightx };
  else if (n === aux.auxh) n.info.coord = { x: midy, y: leftx };
  else n.info.coord = { x: n.info.coord.x, y: midx };
}
```

`Node` is already imported; `g.info.nlist`/`n.info.next` is the standard
nlist idiom (see `splines-label.ts:setEdgeLabelPos`).

## Write-set

- `src/layout/dot/splines-flat.ts`
- `src/layout/dot/splines-flat.test.ts` (create)

## Read-set

- `src/layout/dot/splines-flat.ts:182-196` (repositionFlatAux)
- `~/git/graphviz/lib/dotgen/dotsplines.c:1215-1232`
- `decisions.md#ad-1`

## Acceptance criteria

- Given `{rank=same a b} a:e->b:w[label="x"]`, when routed, then the edge
  spline equals the dot 15.0.0 oracle within 0.5pt:
  `M54,-18C62.13,-18 60.91,-26.42 68.62,-29 71.47,-29.95 72.53,-29.95 75.38,-29 78.03,-28.11 79.62,-26.54 80.91,-24.85`
- Given a no-label ported flat (`a:e->b:w`), when routed, then the spline
  stays conformant (`M54,-18C56.75,-18 58.79,-18 60.61,-18`).
- Given `npx vitest run`, then >= 1853 pass, zero golden churn.

## Observability / Rollback

N/A. Reversible — revert the commit.

## Comparison page

`comparisons/dot-11a-spline.md`: input, oracle spline, port spline, verdict.
Reference in the journal.

## Commit

`fix(T1): reposition aux virtual nodes via nlist (DOT-11a)`
