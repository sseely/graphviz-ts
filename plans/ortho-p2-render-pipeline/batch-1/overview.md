# Batch 1 — oracle-pin partition.ts

The lowest unpinned stage: `partition(cells, bb)` partitions the gcell set into
rectangles via Seidel trapezoidation (P1, pinned) + `monotonate`/chain logic.
Pinned first because `mkMaze` (T2) consumes its output.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Oracle-pin `partition.ts` vs native C (rect set for fixtures, fixed permute) | sonnet | `src/ortho/partition.test.ts`, `src/ortho/partition.ts` (only if parity fix) | — | [x] |

## Gate after batch
- `npm run typecheck` 0 · `npm test` (new partition tests pass; baseline
  unchanged) · `npm run build` OK · C tree clean.
- **Any existing test/golden change ⇒ STOP** (ADR-4).

## Oracle (shared across batches)
Instrument `partition.c` (+ `maze.c`/`ortho.c` for later batches), rebuild the
dot plugin (`make` in `~/git/graphviz/build`), copy to `/tmp/gvmine`, run
`GVBINDIR=/tmp/gvmine dot -Tsvg` on the `splines=ortho` fixtures, dump the
**permute**, the input gcells (bbs), and the output rects; then **revert C**.
Pin TS `partition` to those values, driving it with the C-dumped gcells + permute.
