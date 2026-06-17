# T1 — DOT-5: port fixLabelOrder + helpers

## Context

graphviz-ts is a faithful TS port; C at `~/git/graphviz` (15.0.0) is the
spec. `fixLabelOrder` reorders a rank's flat-label vnodes when their rank
order conflicts with their endpoint intervals.

## Task

Create `src/layout/dot/label-order.ts` with a lightweight per-rank aux
graph and the reorder algorithm (AD-1, AD-2):

- Aux node: `{ lo: number; hi: number; np: Node; idx: number; x: number;
  out: AuxNode[]; in: AuxNode[] }` (idx = `np.info.order`).
- `addStrictEdge(from, to)` — dedup (Agstrictdirected).
- `fixLabelOrder(nodes: AuxNode[], rank: RankEntry): void`:
  1. For each pair (n, then each later v): `hi(v) ≤ lo(n)` → edge v→n +
     `haveBackedge=true`; else `hi(n) ≤ lo(v)` → edge n→v.
  2. If no backedge, return.
  3. For each node with `x===0` and degree>0: `getComp` (DFS in+out, mark
     x=1, collect idx into `indices`, count backedges); if component has a
     backedge, `topsort` it, sort `indices`, and for each i set
     `np.info.order = indices[i]` and `rank.v[indices[i]] = np`.
- `getComp`, `topsort`, `findSource` (in-degree 0 within the component),
  `ordercmpf` (numeric sort of indices) — faithful to `mincross.c:178-224`.

Keep functions ≤30 lines / CCN ≤10 (extract helpers).

## Write-set

- `src/layout/dot/label-order.ts` (create)
- `src/layout/dot/label-order.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/dotgen/mincross.c:115-289`
- `src/layout/dot/mincross.ts` (RankEntry shape, Node.order)
- `decisions.md#ad-1`, `#ad-2`

## Acceptance criteria

- Given 2 aux nodes positioned opposite to their intervals (node at order 0
  has interval right of node at order 1), when `fixLabelOrder`, then their
  `np.info.order` and `rank.v[]` are swapped to interval order.
- Given 2 aux nodes already in interval order, when `fixLabelOrder`, then
  nothing changes (no backedge).
- Given a 3-node component with a cyclic-ish conflict, when `fixLabelOrder`,
  then the topological order is applied (assert exact resulting orders).
- Given `npx vitest run`, then ≥ 1860 pass, zero golden churn.

## Observability / Rollback

N/A. Reversible — revert the commit.

## Commit

`feat(T1): port fixLabelOrder reorder for flat labels (DOT-5)`
