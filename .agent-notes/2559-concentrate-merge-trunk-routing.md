## Observation: 2559 concentrate merge is detected but trunk geometry never routed

- **Context**: Planning a mission to fix corpus test 2559 (`concentrate=true`,
  diverged, maxDelta=0, firstDiff `svg/g[1]/g[5][childCount]`). Graph:
  `a->b [label="1"]`, `c->b`, `d->b`.
- **Finding**: Instrumented `src/layout/dot/conc.ts` (CONC_DEBUG, reverted after):
  - Rank 1 holds `[label-node(a->b), vnode(c->b), vnode(d->b)]` — contiguous.
  - `bothupcandidates` fires (`both=true`); `mergeVirtual ENTER r=1 lpos=1 rpos=2
    dir=UP` executes. So detection + `mergeVirtual` are CORRECT.
  - Yet final SVG draws c->b and d->b as independent single-path edges. Native
    (dot 15.x) draws c->b (edge2) as a TWO-`<path>` merged trunk with d->b joining
    it. The childCount diff = native edge2 has the extra trunk `<path>`.
  - Root cause is DOWNSTREAM of the merge: the merged virtual node at rank 1 has
    `in.size==2, out.size==1`, so C `spline_merge(n)` (dotsplines.c:108) is true and
    `make_regular_edge` (dotsplines.c:1718-1873, hackflag path) builds the shared
    trunk. The port's chain router (`edge-route-chain.ts`, breaks at
    `splineMerge(vn)` line 290; `splines-route.ts:splineMerge`) does not emit the
    trunk segment — it routes each original directly.
- **Impact**: This is the suspected fix locus: merged-chain → spline routing, NOT
  the conc.ts predicates/mergeVirtual (those are faithful). 2559 is a MINIMAL repro
  of a real merged-trunk routing gap. Reframes [[b69-concentrate-undermerge]]: b69's
  residual was proven x-coord (merge correct), but b69's x-coord noise may have
  MASKED this trunk-routing gap. Verify any fix against b69/b135/167/2087/b62/b71.
- **Confidence**: High (detection/merge instrumented and confirmed; routing locus
  inferred from C spec + port structure, to be pinned in mission Task 1).
