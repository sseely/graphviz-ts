# T2 — DOT-5: port checkLabelOrder, wire it

## Context

T1 ported `fixLabelOrder`. `checkLabelOrder` (`mincross.c:297`) builds the
per-rank aux node set from `posAlg`-marked label vnodes and calls
`fixLabelOrder` when a rank has >1.

## Task

1. Add `checkLabelOrder(g: Graph): void` to `label-order.ts`:
   - For each rank r in `g.info.rank` (minrank..maxrank): for each node `u`
     in `rank.v` with `u.info.posAlg !== undefined`, build an aux node:
     `lo/hi` = the `.info.order` of the heads of `u`'s first two out-edges
     (swap so lo ≤ hi); `np = u`.
   - If the rank yielded >1 aux node, call `fixLabelOrder(auxNodes, rank)`.
   - (C builds a fresh aux graph per rank; the TS aux structure is per-rank.)
2. Replace the stub at `flat.ts:224` — remove it, import `checkLabelOrder`
   from `label-order.ts`, keep the call at `flat.ts:319`.
3. `recResetVlists` (AD-4): if a `MincrossContext` is available at the
   `flatEdges`/position call site, call `recResetVlists(ctx, g)` after
   `checkLabelOrder`. If plumbing the ctx exceeds the write-set, leave it
   and record the gap in the journal — STOP rather than balloon.

## Write-set

- `src/layout/dot/label-order.ts`
- `src/layout/dot/label-order.test.ts`
- `src/layout/dot/flat.ts`

## Read-set

- `~/git/graphviz/lib/dotgen/mincross.c:297-326`, `flat.c:331-333`
- `src/layout/dot/flat.ts:216-225, 313-320` (stub + call site)
- `src/layout/dot/mincross.ts:106-114` (recResetVlists)
- `decisions.md#ad-3`, `#ad-4`

## Acceptance criteria

- Given a synthetic graph/rank with 2 `posAlg` label vnodes whose out-edge
  endpoint orders conflict with the vnode order, when `checkLabelOrder`,
  then the vnodes are reordered (integration of T1).
- Given a rank with ≤1 label vnode, when `checkLabelOrder`, then nothing
  changes.
- Given `npx vitest run`, then ≥ 1862 pass, zero golden churn (the reorder
  fires for no golden — verified 0/300 corpus).

## Observability / Rollback

N/A. Reversible — revert the commit.

## Comparison page

`comparisons/dot-5-checklabelorder.md`: the algorithm, the unit-test
conflict case (input orders/intervals → output orders), and the note that
no realistic e2e trigger exists in the TS-supported input space. Reference
in the journal.

## Commit

`feat(T2): wire checkLabelOrder for flat-edge labels (DOT-5)`
