<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2b — Straight-mode segmentation

## Context
Faithful TS port of C graphviz. With `straightPath` (T1) and the segmented
scaffold `routeChainSegmented` (T2a) in place, add the smode branch so long
edges with a collinear vnode run are split: spline-top + straight-middle +
spline-bottom, matching C `make_regular_edge`.

## Task
Extend `routeChainSegmented` in `src/layout/dot/edge-route-chain.ts` with the
smode loop from `~/git/graphviz/lib/dotgen/dotsplines.c:1771-1837`:

- Walk the chain (`while hn is VIRTUAL && !splineMerge(hn)`), appending
  `rankBox` per step (as today).
- When `!smode && straightLen(hn) >= (has EDGE_LABEL ? 5 : 3)`: set
  `smode=true; si=true; sl -= 2;` (EDGE_LABEL via `g.info.has_labels & 1`).
- When `!smode || si`: clear `si`; append `maximalBbox(...)`; advance to
  `hn.info.out.list[0]`; continue (this is the normal step).
- Else (smode segment close): build `hend` via `maximalBbox`, `endPath`,
  `makeregularend(TOP, hn.y + rank.ht2)`; set `P.end.theta = π/2`,
  `P.end.constrained = true`; `completeRegularPath`; route this segment via
  `routeRegularByType(P, et)` (et=SPLINE per AD-3); append its points to the
  accumulator; `straightPath(hn.info.out.list[0], sl, pts)` to emit the straight
  middle and advance; `recoverSlack(segfirst, P)`; reset `segfirst`; begin the
  next segment: `tend = maximalBbox`, `beginPath`,
  `makeregularend(BOTTOM, tn.y - rank.ht1)`, `P.start.theta = -π/2`,
  `P.start.constrained = true`; `smode = false`.
- Final segment after the loop: as today (endPath + complete + route + append +
  recoverSlack).
- Return the accumulated points.

Preserve C's order of operations exactly (AD-4). Keep the back-edge path
(`faithfulBackFwdPoints`, which reverses) working — it shares
`routeChainSegmented`. Keep helpers ≤ CCN 10 and file ≤ 500 lines (AD-2).

## Write-set
- `src/layout/dot/edge-route-chain.ts`
- `src/layout/dot/edge-route-chain.straight.test.ts` (new)

## Read-set
- `~/git/graphviz/lib/dotgen/dotsplines.c:1771-1870` (the smode loop + final seg)
- `src/layout/dot/splines-route.ts` (straightLen, straightPath from T1)
- `src/common/splines-routespl.ts:295-305` (start/end theta+constrained usage)
- `src/layout/dot/edge-route-faithful.ts` (maximalBbox, rankBox, appendRegularEnd,
  completeRegularPath, freshEndp) — exact signatures
- decisions.md#ad-3, decisions.md#ad-4

## Acceptance criteria
- Given `digraph { a->b->c->d->e->f; a->f; }` (L5), when rendered, then the `a->f`
  spline byte-matches `~/git/graphviz/build/cmd/dot/dot` (GVBINDIR=/tmp/gvplugins).
- Given `a->b->c->d; a->d` (L3) and `a->b->c->d->e; a->e` (L4), when rendered,
  then output is unchanged from T2a (no-op below threshold).
- Given `graphs/p2.gv` (no clusters; `kernel--runmem`), when rendered, then that
  edge gains the corridor-hugging segmentation (oracle: 13 pts; was 7).
- Given `npx vitest run`, then all tests pass (2000 + new straight tests).
- Given the parity survey, then per-id deltas vs baseline show 0 regressions
  (improvements expected in the path/@d bucket).

## Observability
N/A.

## Rollback
Reversible. STOP triggers: any parity regression (not strict re-bucketing); a
hang/timeout; same divergence approached 3×.

## Quality bar
One commit: `feat(edge-route): port straight-mode segmentation for long edges`.
Body (>3 files not expected; explain why): references the C smode loop and L5
repro.
