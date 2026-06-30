# T2 — `removeFromRank` helper

## Context

`removeFill` (T4) must pull placeholder nodes out of their rank's `v[]` array
after layout. Only `install_in_rank` exists in `fastgr.ts`; its inverse is
missing (backlog notes `remove_from_rank` as MISSING).

## Task

Add `removeFromRank(g, n)` to `src/layout/dot/fastgr.ts`, beside
`install_in_rank` — the structural inverse: remove `n` from `g.info.rank[r].v`
(where `r = n.info.rank`), compacting the slot and decrementing `n`/`an` counts
to match what `install_in_rank` set. Mirror C `mincross.c:remove_from_rank`.

## Write-set

- `src/layout/dot/fastgr.ts` — add `removeFromRank`
- `src/layout/dot/fastgr.test.ts` — unit test (create if absent; otherwise add)

## Read-set

- `decisions.md#ad-2`
- `src/layout/dot/fastgr.ts` (`install_in_rank` / `installInRank`)
- `~/git/graphviz/lib/dotgen/mincross.c:remove_from_rank`

## Interface contract (consumed by T4)

```
removeFromRank(g: Graph, n: Node): void
```

## Acceptance criteria

- **Given** a node installed at rank r order o, **when** `removeFromRank(g, n)`,
  **then** it is removed from `rank[r].v` and `rank[r].n` is decremented.
- **Given** `installInRank` then `removeFromRank` for the same node, **then**
  the rank entry's `v`/`n` match its pre-install state.
- **Given** the 115 goldens, **then** all conformant (helper unused by
  default paths).

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates.
Commit: `feat(T2): add removeFromRank (inverse of install_in_rank)`.

## Observability / Rollback

N/A. Reversible (revert; additive).
