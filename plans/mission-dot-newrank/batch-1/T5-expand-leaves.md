# T5 — Implement `expandLeaves` (LEAFSET)

## Context

`expandLeaves` (`position.ts`, no-op stub ~173) is called from `dotPosition`
after `makeLeafSlots` (already present). It expands `LEAFSET`-packed leaf nodes
into their rank slots and rewires their leaf edges. Independent of newrank.

## Task

Port `lib/dotgen/position.c:expand_leaves` faithfully:
1. Call `makeLeafSlots(g)` (already ported — confirm and reuse).
2. For each node `n` with a non-empty `ND_other` list, for each edge `e`: if the
   head-rank delta is non-zero and `e`'s ports differ from `ED_to_orig(e)`
   (`ports_eq`), `zapinlist` `e` out of `ND_other`, and for delta==1
   `fast_edge(e)`. Mirror the C loop exactly (including the `i--` after removal;
   the `else unitize(e)` branch is commented out in C — do NOT add it).

Use existing primitives: `ND_other`, `ED_to_orig`, `ports_eq` (cluster.ts),
`fast_edge` (fastgr.ts), `zapinlist` (fastgr.ts).

## Write-set

- `src/layout/dot/position.ts` — implement `expandLeaves`
- `src/layout/dot/leafset.test.ts` — oracle pins

## Read-set

- `~/git/graphviz/lib/dotgen/position.c:expand_leaves` + `make_leafslots`
- `src/layout/dot/position.ts` (`makeLeafSlots`, the LEAFSET ordering loop ~165)
- `ports_eq` in `cluster.ts`; `fast_edge`/`zapinlist` in `fastgr.ts`
- LEAFSET constant in `rank.ts`

## Acceptance criteria

- **Given** a graph that triggers LEAFSET packing, **when** rendered, **then**
  leaf-node positions match the dot oracle ≤0.5pt (capture from
  `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`).
- **Given** any non-LEAFSET graph, **then** `expandLeaves` makes no change and
  output is conformant.
- **Given** the 115 goldens, **then** all conformant.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates.
Commit: `feat(T5): implement expand_leaves for LEAFSET leaf packing`.
If LEAFSET parity is unreachable, STOP per AD-4 (keep stub, re-scope with a
comparison page in `comparisons/leafset.md`) — do not regress.

## Observability / Rollback

N/A. Reversible (revert; LEAFSET-gated, goldens conformant).
