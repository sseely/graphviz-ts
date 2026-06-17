# Mission: dot checkLabelOrder (DOT-5)

## Objective

Port `checkLabelOrder` / `fixLabelOrder` (`lib/dotgen/mincross.c:246,297`)
so flat-edge label virtual nodes whose rank order conflicts with their
endpoint intervals get reordered (avoids the infeasible dot_position
problem the C comment describes). Replaces the no-op stub at
`flat.ts:224`.

## Deep-dive findings (C-instrumented, 2026-06-17)

- The aux-graph build runs whenever a rank has ≥2 flat-edge labels, but the
  actual reorder (`haveBackedge`) is RARE: **0 of 300 corpus graphs**
  hand-tested triggered it; only `tests/2471.dot` (35k lines, HTML+clusters)
  does. 15+ minimal constructions never triggered.
- ⇒ **No clean e2e oracle test.** Correctness gate = a deterministic UNIT
  test of `fixLabelOrder` (construct conflicting intervals → assert reorder).
- Label vnodes are marked `info.posAlg = e` (the `ND_alg` equivalent, set by
  `flatNode`); `lo/hi` = `vn.outEdges[0/1].head.info.order`.
- `recResetVlists` exists (`mincross.ts:106`) but is cluster-only and its
  `MincrossContext` isn't plumbed to the position-phase `flatEdges` call.

## Algorithm (faithful to C)

```mermaid
flowchart TD
  A[checkLabelOrder: per rank] --> B[collect posAlg vnodes → aux nodes lo/hi]
  B -->|>1 node| C[fixLabelOrder]
  C --> D[pairwise interval edges: hi(v)≤lo(n)→v→n backedge; hi(n)≤lo(v)→n→v]
  D -->|no backedge| E[return unchanged]
  D -->|backedge| F[per component: getComp + topsort → reassign ND_order + rk.v]
```

## Branch / merge

- Branch: `feature/dot-checklabelorder`; merge commit to `main`.

## Constraints (stop / push-forward)

**STOP when:** any golden churns (the reorder fires for 0 goldens, so they
must stay byte-identical); `recResetVlists` ctx plumbing exceeds the
write-set; 2 consecutive gate failures; a fix needs a file outside the
write-set.

**PUSH FORWARD when:** hook-limit helper split; purely stylistic choice.

## Quality gates

- `npx tsc --noEmit` → 0
- `npx vitest run` → ≥ 1860, zero golden churn
- Hook limits: 30 lines/fn, CCN 10, 5 params, 500/file.

## Baseline (2026-06-17, main): tsc 0, vitest 1860 passed.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 (fixLabelOrder), T2 (checkLabelOrder + wire) | [x] |

## Outcome (2026-06-17) — DONE

`checkLabelOrder`/`fixLabelOrder` ported (`label-order.ts`) and wired into
`flat.ts` (stub removed). `fixLabelOrder` is C-verified against the only
corpus trigger (`tests/2471.dot` rank 9, MATCH=true). 1864 pass, zero golden
churn. `recResetVlists` (cluster-only) deferred per AD-4. Merged to main.

## Index

- [decisions.md](decisions.md)
- [batch-1/overview.md](batch-1/overview.md)
- [batch-1/T1-fix-label-order.md](batch-1/T1-fix-label-order.md)
- [batch-1/T2-check-label-order.md](batch-1/T2-check-label-order.md)
- [decision-journal.md](decision-journal.md)
