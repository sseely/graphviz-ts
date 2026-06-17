# T3 — `fillRanks` / `realFillRanks` + `makeFillNode`

## Context

`fillRanks` (`mincross-build.ts`, no-op stub ~258) is already called from
`mincross.ts:152` under the `NEW_RANK` flag (set by `dotRank` when `newrank` is
true; `dot2Rank` ranking is ported). Without it, ranks left empty by clustered
layout get no placeholder, so cross-cluster ranks don't reconcile (verified: `c`
mis-ranked vs the oracle). This task fills those ranks.

## Task

Port `lib/dotgen/mincross.c:realFillRanks` + `fillRanks` faithfully:
1. `realFillRanks(g, ranks, sg)`: recurse into each cluster (`GD_clust`); for a
   non-root graph, mark a rank-occupancy boolean array — set true for every
   node's rank AND every rank spanned by an out-edge (`ND_rank(n)+1 .. ND_rank
   (head)`). For each rank in `[minrank,maxrank]` not occupied, create (lazily)
   the `_new_rank` subgraph via `agsubg(dotRoot(g),"_new_rank",true)` (AD-1) and
   add a placeholder via `makeFillNode` → `agsubnode(g, n, true)`. Return `sg`.
2. `fillRanks(g)`: size the occupancy array to `maxrank+2`, call `realFillRanks`.
3. `makeFillNode(g, rank)` (AD-3): `agnode(g, null, true)` with `lw=rw=0.5`,
   `ht=1`, `ufSize=1`, empty in/out elists, `rank` set; synthetic name
   `__fill_<rank>_<seq>`.

Use a `boolean[]` (or `Set<number>`) for the C `bitarray_t`. Keep
`realFillRanks` within 30 lines/fn — extract `makeFillNode` and the occupancy
marking into helpers.

## Write-set

- `src/layout/dot/mincross-build.ts` — `fillRanks`, `realFillRanks`,
  `makeFillNode`, occupancy helper
- `src/layout/dot/mincross-build.test.ts` — model-level unit test (create or add)

## Read-set

- `decisions.md#ad-1`, `#ad-3`
- `~/git/graphviz/lib/dotgen/mincross.c:realFillRanks` (line 976), `fillRanks`
  (1014), `init_mincross` call site (`if (GD_flags(g) & NEW_RANK)`)
- T1 interface (`agsubg`/`agnode`/`agsubnode`)
- `mincross-build.ts:258` (stub), `mincross.ts:152` (call site),
  `install_in_rank` / fast-node alloc in `fastgr.ts`

## Interface contract (consumed by T4)

After `fillRanks(g)` on a `newrank` graph: a `_new_rank` subgraph exists under
the root containing one placeholder node (`lw=rw=0.5, ht=1, ufSize=1`) per
formerly-empty rank, each installed into its rank's `v[]`.

## Acceptance criteria

- **Given** `newrank=true` with a rank gap (the README repro), **when**
  `fillRanks` runs, **then** every rank in `[minrank,maxrank]` has ≥1 node and
  each gap rank got a `_new_rank` placeholder with the C field values.
- **Given** a graph WITHOUT `newrank`, **then** `fillRanks` is never invoked
  (flag-gated) and rank arrays are unchanged.
- **Given** the 115 goldens, **then** all byte-identical.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates.
Commit: `feat(T3): port fillRanks/realFillRanks for newrank placeholder ranks`.

## Observability / Rollback

N/A. Reversible (revert; newrank-gated, goldens byte-identical).
