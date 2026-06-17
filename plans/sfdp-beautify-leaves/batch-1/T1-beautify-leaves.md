# T1 — SFDP-1: port beautifyLeaves

## Context

graphviz-ts is a faithful TS port; C at `~/git/graphviz` (15.0.0) is the
spec. `beautify_leaves` fans each node's degree-1 leaves around it at their
average distance. Building blocks exist: `distance` (`spring-electrical.ts:155`),
`fma` (`common/fma.ts`), SparseMatrix `ia/ja/m`.

## Task

Add to `spring-electrical.ts` (do NOT wire yet — T2 wires):

```ts
function setLeaves(x, dim, dist, ang, i, j) {
  x[dim*j]   = fma(Math.cos(ang), dist, x[dim*i]);     // AD-2
  x[dim*j+1] = fma(Math.sin(ang), dist, x[dim*i+1]);
}
// gatherLeaves(A, p, checked, x, dim) -> { leaves: number[], avgDist }
//   for j in ia[p]..ia[p+1]: if node_degree(ja[j])==1: mark checked, accumulate
//   distance(x,dim,p,ja[j]), push ja[j]; avgDist = sum/leaves.length
export function beautifyLeaves(dim, A, x): void {
  const { ia, ja, m } = A; const checked = new Array<boolean>(m).fill(false);
  for (let i=0; i<m; i++) {
    if (ia[i+1]-ia[i] !== 1 || checked[i]) continue;
    const p = ja[ia[i]];
    if (checked[p]) continue;
    checked[p] = true;
    const { leaves, avgDist } = gatherLeaves(...);   // marks leaves checked
    const pad = 0.1, ang2 = 2*Math.PI - pad;
    let ang1 = pad;
    const step = leaves.length > 1 ? (ang2 - ang1)/leaves.length : 0;
    for (const leaf of leaves) { setLeaves(x, dim, avgDist, ang1, p, leaf); ang1 += step; }
  }
}
```

Faithful to C `beautify_leaves` (`spring_electrical.c:195`): pad=0.1, fan
`[pad, 2π−pad]`, `step = range/count`, process each parent once via
`checked`. Keep CCN ≤10 / fns ≤30 lines (the helpers do that).

## Write-set

- `src/layout/sfdp/spring-electrical.ts`
- `src/layout/sfdp/spring-electrical.test.ts`

## Read-set

- `~/git/graphviz/lib/sfdpgen/spring_electrical.c:188-238`
- `src/layout/sfdp/spring-electrical.ts:150-165` (distance)
- `src/layout/sfdp/sparse-matrix.ts` (ia/ja/m)
- `decisions.md#ad-1`, `#ad-2`, `#ad-3`

## Acceptance criteria

- Given a star matrix (center 0 with degree-1 leaves 1..k, no diagonal) and
  an x array, when `beautifyLeaves(2, A, x)` runs, then each leaf `j` (in
  `ja` order, index t) sits at `fma(cos(pad+t·step), d, cx)`,
  `fma(sin(pad+t·step), d, cy)` where `d` = mean leaf distance, `pad=0.1`,
  `step=(2π−2·0.1)/k`. Assert to ≥12 digits (pure function, deterministic).
- Given a node with no degree-1 neighbours, when run, then its position is
  unchanged.
- Given `npx vitest run`, then ≥ 1856 pass, zero golden churn (not yet wired).

## Observability / Rollback

N/A. Reversible — revert the commit.

## Commit

`feat(T1): port beautifyLeaves radial leaf placement (SFDP-1)`
