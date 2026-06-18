# Batch 2 — oracle-pin maze.ts

`mkMaze(g)` builds the gcells, calls `partition` (T1, pinned), assembles the
maze cells, and builds the search graph via `mkMazeGraph`. Pin the cell set,
gcell set, and search-graph (snode/sedge) structure to native C.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Oracle-pin `mkMaze` vs native C (cells, gcells, sg nodes/edges) | sonnet | `src/ortho/maze.test.ts`, `src/ortho/maze.ts` (only if parity fix) | T1 | [x] |

## Dependency
T2 depends on T1 — a maze-cell divergence is often a partition bug; T1 must be
green first (ADR-3 bottom-up).

## Gate after batch
- `npm run typecheck` 0 · `npm test` (new maze tests + T1 pass; baseline
  unchanged) · `npm run build` OK · C tree clean.
- **Any existing test/golden change ⇒ STOP** (ADR-4).
