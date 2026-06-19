# T2 — Oracle-pin maze.ts (mkMaze)

## Context
Faithful TS port (root `CLAUDE.md`). `mkMaze(g)` (`src/ortho/maze.ts:246`, port
of `maze.c:452`) builds gcells from node obstacles + graph bbox, calls
`partition` (T1, pinned), assembles the maze `cells`, and builds the search
graph (`sg`) via `mkMazeGraph`. Pin the full maze structure to native C. Depends
on T1 (partition green). Tests: vitest; TS strict.

## Task
1. Reuse the T1 fixtures (same `splines=ortho` graphs). Via the gvmine oracle,
   dump for each: node positions/sizes (to drive the TS `OrthoGraph`, ADR-2),
   the `gcells` (bbs), the maze `cells` (bbs, nsides, side-node refs), and the
   search graph (`sg.nnodes`, `sg.nedges`, per-node `isVert`/`cells` linkage,
   per-edge `v1/v2/weight`).
2. Write `maze.test.ts`: build the `OrthoGraph` from C-dumped node positions,
   call `mkMaze`, assert `ncells`, `ngcells`, cell bbs, and the sg node/edge sets
   equal C (order-normalized where C order isn't reproducible).
3. Drill divergences (after confirming T1 partition is green for the fixture);
   faithful fixes confined to `maze.ts`.

## Write-set
- `src/ortho/maze.test.ts` (create)
- `src/ortho/maze.ts` (modify — only on parity divergence)

## Read-set
- `~/git/graphviz/lib/ortho/maze.c` (mkMaze:452, mkMazeGraph:331)
- `src/ortho/maze.ts`, `src/ortho/partition.ts` (T1), `src/ortho/sgraph.ts` (P1)
- `decisions.md` (ADR-1/2/3/5); `[[recover-slack-and-c-harness]]`

## Architecture decisions (locked)
ADR-1 (gvmine oracle), ADR-2 (C-dumped positions), ADR-3 (bottom-up — T1 first),
ADR-4 (additive), ADR-5 (faithful). STOP on required deviation.

## Interface contract
`mkMaze(g: OrthoGraph): Maze` — unchanged; `Maze.{cells,gcells,ncells,sg,...}`
pinned to C.

## Acceptance criteria
- Given a fixture's C-dumped node positions, when `mkMaze`, then `ncells`,
  `ngcells`, and all cell bbs equal the C dump.
- Given the same, then the search graph `sg` (node count, edge count, each
  edge's `v1/v2/weight`, each node's `isVert` + cell linkage) equals C
  (order-normalized where needed).
- Given identical inputs twice, then identical maze (determinism).
- C tree clean post-mint.

## Observability requirements
N/A — test-only library code.

## Rollback notes
**Reversible** (ADR-4). New test + optional faithful fix.

## Quality bar
`npm run typecheck` 0 · `npm test` (T2 + T1 pass; baseline unchanged) ·
`npm run build` OK · C tree clean. CCN/length caps apply; consecutive-fix STOP.
Return only the structured result.

## Commit
`test(T2): oracle-pin ortho mkMaze vs native C` (+ `fix(T2): …`).

## Boundaries
- **Never:** edit outside the write-set; leave C instrumentation uncommitted;
  optimize maze construction; chase a maze divergence before T1 is green.
- **Ask first (STOP):** parity fails after 3 attempts at one site; maze is
  nondeterministic for a fixture.
