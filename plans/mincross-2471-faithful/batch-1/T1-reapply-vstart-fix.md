# T1 — Re-apply the vStart fix to medians/reorder

## Context

graphviz-ts ports Graphviz C faithfully; `~/git/graphviz` is the spec. The
mincross `medians` and `reorder` functions index `rk.v[i]` from 0, ignoring the
`vStart` window offset, so for windowed graphs (multi-component comp≥2, all
clusters) they process the wrong nodes. `transpose` already uses `rankGet`
(correct). This fix is fully derived in
`../../mincross-2471-order-parity/faithful-fix.md` — apply it verbatim.

## Task

Apply exactly the two changes in `faithful-fix.md`:
1. `medians`: replace `rk.v[i]` with `rankGet(rk, i)` (import `rankGet` from
   `./mincross-utils.js`).
2. `reorder` + `reorderInner`: iterate the **absolute** window
   `[vStart, vStart+n)` — `reorderInner` takes `win: {start, ep}` and starts
   `lp = win.start`; `reorder` computes `start = rk[r].vStart ?? 0`,
   `ep = start + rk[r].n`.
3. Update the two `reorderInner(...)` call sites in the test file to pass
   `{ start: 0, ep: 2 }`.
4. Add **windowed unit tests**: a `reorder` and a `medians` test where the rank
   entry has `vStart > 0`, asserting only the window `[vStart, vStart+n)` is
   touched and node `order` stays == absolute index.

## Write-set
- `src/layout/dot/mincross-order.ts`
- `src/layout/dot/mincross-order.test.ts`

## Read-set
- `../../mincross-2471-order-parity/faithful-fix.md` (the exact diff)
- `src/layout/dot/mincross-order.ts` (medians ~L118, reorder ~L208)
- `src/layout/dot/mincross-utils.ts:113-124` (rankGet/rankSet/vStart)

## Interface outputs (consumed by T2)
The fixed `medians`/`reorder` now read `rk.v[vStart+i]`. T2 relies on this when
comparing windowed-graph order to C.

## Acceptance criteria
- Given the fix, when `npm run typecheck`, then exit 0.
- Given the fix, when `npm test`, then all tests pass (≥1874; the 2 updated
  call sites + new windowed tests included).
- Given a rank with `vStart=2, n=3`, when `reorder` runs, then nodes at absolute
  indices `0,1` (outside the window) are never exchanged and every windowed
  node's `order` equals its absolute index.
- Given the diff, when compared to `faithful-fix.md`, then it matches exactly
  (no extra changes).

## Observability
N/A — no new observable operations (layout-algorithm internals).

## Rollback
Reversible — revert the commit. No data/schema. (Note: this fix alone makes 2471
hang; that is expected and resolved by Batch 3. Do NOT run 2471 to "verify" T1.)

## Quality bar
`npm run typecheck` 0; `npm test` green. Commit: `fix(T1): medians/reorder honor
vStart window`.
