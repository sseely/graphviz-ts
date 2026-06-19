# T3 — Port sgraph.c + fPQ.c (search graph + priority queue + shortPath)

## Context
Faithful TS port of Graphviz `lib/ortho/sgraph.c` (191 LOC) and `lib/ortho/fPQ.c`
(119 LOC) for the `graphviz-ts` faithful-port project (root `CLAUDE.md`). The
search graph (`snode`/`sedge`/`sgraph`) is the maze routing graph; `fPQ` is its
binary-heap priority queue; `shortPath` is Dijkstra over the sgraph using the PQ.
One agent owns BOTH files because `fPQ` operates on `snode` and `shortPath` ties
them together. Tests use **vitest**; TS strict; no Node-only APIs.

## Task
Port every struct and function from `sgraph.{c,h}` + `fPQ.{c,h}`, C boundaries and
side-effect order preserved (ADR-1):
- Types: `snode { n_val,n_idx,n_dad,n_edge,n_adj,save_n_adj,cells[2],
  adj_edge_list,index,isVert }`, `sedge { weight,cnt,v1,v2 }`,
  `sgraph { nnodes,nedges,save_nnodes,save_nedges,nodes,edges }`, `pq_t`.
- sgraph fns: `createSGraph(sz)`, `createSNode(g)`, `createSEdge(g,v0,v1,wt)`,
  `initSEdges(g,maxdeg)`, `reset(g)`, `gsave(g)`, `freeSGraph` (TS: drop/no-op —
  document), `shortPath(pq,g,from,to)`.
- fPQ fns: `PQgen(sz)`, `PQinit(pq)`, `PQ_insert(pq,np)`, `PQremove(pq)`,
  `PQupdate(pq,n,d)`, `PQfree` (TS: drop/no-op). Heap macros `N_VAL/N_IDX/N_DAD/
  N_EDGE/E_WT` → field accesses. Binary-heap sift order MUST match C exactly
  (tie-handling is load-bearing for oracle parity).
- `snode.cells[2]` references `cell` (P2 maze). Per ADR-1/decisions.md, declare a
  minimal opaque `Cell` forward type (e.g. `type Cell = unknown` or an empty
  interface) — **P1 must not deref cell internals**. `adj_edge_list` is `int[]`
  (indices into `sgraph.edges`).

## Write-set
- `src/ortho/sgraph.ts` (create), `src/ortho/sgraph.test.ts` (create)
- `src/ortho/fPQ.ts` (create), `src/ortho/fPQ.test.ts` (create)

## Read-set
- `~/git/graphviz/lib/ortho/sgraph.c` + `sgraph.h` (full)
- `~/git/graphviz/lib/ortho/fPQ.c` + `fPQ.h` (full)
- `decisions.md` (ADR-1, ADR-2, ADR-4, ADR-5, cell-forward-type note)
- a vitest example test

## Architecture decisions (locked)
ADR-1 (index-based: `sedge.v1/v2` and `adj_edge_list` are indices, `n_dad` is an
snode ref per C), ADR-2 (sgraph/pq are explicit context, no globals), ADR-4
(unwired), ADR-5 (C oracle). STOP on any required deviation.

## Interface contract (output — consumed by P2 maze + P3 ortho, NOT this mission)
```ts
type Cell = unknown; // opaque forward type; replaced in P2 (maze)
interface SNode { n_val:number; n_idx:number; n_dad:SNode|null; n_edge:SEdge|null;
  n_adj:number; save_n_adj:number; cells:[Cell|null,Cell|null];
  adj_edge_list:number[]; index:number; isVert:boolean; }
interface SEdge { weight:number; cnt:number; v1:number; v2:number; }
interface SGraph { nnodes:number; nedges:number; save_nnodes:number;
  save_nedges:number; nodes:SNode[]; edges:SEdge[]; }
interface PQ { /* per fPQ.c */ }
function createSGraph(sz:number):SGraph;
function createSNode(g:SGraph):SNode;
function createSEdge(g:SGraph, v0:SNode, v1:SNode, wt:number):SEdge;
function initSEdges(g:SGraph, maxdeg:number):void;
function reset(g:SGraph):void; function gsave(g:SGraph):void;
function PQgen(sz:number):PQ; function PQinit(pq:PQ):void;
function PQ_insert(pq:PQ, np:SNode):number; function PQremove(pq:PQ):SNode|null;
function PQupdate(pq:PQ, n:SNode, d:number):void;
function shortPath(pq:PQ, g:SGraph, from:SNode, to:SNode):number;
```

## Acceptance criteria
- Given `PQgen` + `PQ_insert` of snodes with `n_val` `[5,1,3,2,4]`, when
  `PQremove` repeatedly, then pops in ascending `n_val` `[1,2,3,4,5]` — pop order
  **identical to C** (incl. equal-key tie order).
- Given a node in the PQ then `PQupdate(n, lower_d)`, when subsequent `PQremove`,
  then heap order reflects the decreased key (matches C).
- Given an sgraph with nodes + weighted sedges, when `shortPath(from,to)`, then the
  `n_dad` back-chain is the minimum-weight path and equals the C dump (path + cost).
- Given `gsave(g)` then mutate then `reset(g)`, then `nnodes/nedges` restore to the
  saved values (`save_nnodes/save_nedges`), matching C.
- Oracle: C-dumped PQ pop sequence + `shortPath` `n_dad` chain for ≥2 fixture
  sgraphs are byte-equal to the TS results.

## Observability requirements
N/A — test-only library code.

## Rollback notes
**Reversible** (ADR-4). New files only.

## Quality bar
`npm run typecheck` 0 · `npm test` (new sgraph/fPQ tests pass; baseline unchanged)
· `npm run build` OK · C tree clean. Return only the structured result — no
preamble/summary.

## Commit
One commit: `feat(T3): port ortho search graph + priority queue + shortPath`.

## Boundaries
- **Never:** deref `cell` internals (P2); introduce globals; edit outside the
  write-set; leave C instrumentation uncommitted; alter heap tie-order from C.
- **Ask first (STOP):** parity failure after 3 attempts at one site; any required
  deviation from ADR-1/2.
