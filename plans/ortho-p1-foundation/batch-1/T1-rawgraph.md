# T1 — Port rawgraph.c (adjacency graph + topological sort)

## Context
Faithful TS port of Graphviz `lib/ortho/rawgraph.c` (100 LOC) for the `graphviz-ts`
project (faithful C→TS port; see root `CLAUDE.md`). This is the directed
adjacency graph used by P2/P3 ortho channel routing. **Standalone** — no deps on
other ortho modules. Tests use **vitest**; TS strict mode; no Node-only APIs.

## Task
Port every function and struct from `lib/ortho/rawgraph.c` + `rawgraph.h`:
`make_graph(n)`, `insert_edge(g,v1,v2)` (directed v1→v2), `remove_redge(g,v1,v2)`
(removes any edge between v1,v2 regardless of direction), `edge_exists(g,v1,v2)`
(directed test v1→v2), `top_sort(g)` (topological sort, sets `vertex.topsort_order`),
`free_graph` (TS: no-op / drop — document). Preserve `vertex { color, topsort_order,
adj_list }` and `rawgraph { nvs, vertices }`. `adj_list` is `LIST(size_t)` → TS
`number[]`. Match C's DFS/coloring order in `top_sort` exactly (side-effect order
is load-bearing — ADR-1).

## Write-set
- `src/ortho/rawgraph.ts` (create)
- `src/ortho/rawgraph.test.ts` (create)

## Read-set
- `~/git/graphviz/lib/ortho/rawgraph.c` (full — it's 100 lines)
- `~/git/graphviz/lib/ortho/rawgraph.h` (struct defs)
- `decisions.md#adr-1-index-based-arrays-not-object-references`,
  `decisions.md#adr-5-oracle--instrumented-native-libortho`
- One existing `src/**/*.test.ts` for the vitest pattern/imports

## Architecture decisions (locked)
ADR-1 (index-based arrays), ADR-2 (no globals — `rawgraph` is the context),
ADR-5 (C oracle). All locked; if a conflict arises, STOP and log.

## Interface contract (output — consumed by P2 partition/ortho, NOT this mission)
```ts
interface Vertex { color: number; topsort_order: number; adj_list: number[]; }
interface RawGraph { nvs: number; vertices: Vertex[]; }
function makeGraph(n: number): RawGraph;
function insertEdge(g: RawGraph, v1: number, v2: number): void;  // directed v1->v2
function removeRedge(g: RawGraph, v1: number, v2: number): void; // either direction
function edgeExists(g: RawGraph, v1: number, v2: number): boolean; // directed v1->v2
function topSort(g: RawGraph): void; // assigns vertices[i].topsort_order
```
(Keep C names recoverable in JSDoc: `@see lib/ortho/rawgraph.c:make_graph` etc.)

## Acceptance criteria
- Given `makeGraph(4)` then `insertEdge(0,1)`,`insertEdge(1,2)`, when `edgeExists`,
  then `(0,1)===true && (1,2)===true && (1,0)===false`.
- Given edges `0→1,1→2,0→2`, when `topSort`, then `topsort_order` yields a valid
  topo order (0 before 1, 1 before 2, 0 before 2) **identical to C's** for this DAG.
- Given edge `0→1` then `removeRedge(1,0)`, then `edgeExists(0,1)===false`
  (direction-agnostic removal).
- Given a fixture DAG (≥5 vertices, branching), when ported vs C, then the full
  `vertices[].adj_list` and `topsort_order` arrays are **byte-equal to the C dump**.

## Observability requirements
N/A — no new observable runtime operation (test-only library code).

## Rollback notes
**Reversible** (ADR-4). New files only; revert the commit. No migration.

## Quality bar
`npm run typecheck` 0 · `npm test` (new rawgraph tests pass; baseline 1876
unchanged) · `npm run build` OK · C tree clean (`git -C ~/git/graphviz status
--porcelain lib/` empty). Return only the structured result — no preamble/summary.

## Commit
One commit: `feat(T1): port ortho rawgraph adjacency graph + topsort`
(per `~/.claude/rules/commits.md`).

## Boundaries
- **Never:** edit any file outside the write-set; leave C instrumentation
  uncommitted; optimize/simplify the C algorithm.
- **Ask first (STOP):** if a faithful port needs a structural deviation beyond
  ADR-1/2, or C-oracle parity fails after 3 attempts at one site.
