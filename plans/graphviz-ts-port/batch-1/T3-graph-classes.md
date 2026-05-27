# T3 — Graph, Node, Edge Base Classes

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC. T3
ports `Agraph_t`, `Agnode_t`, and `Agedge_t` from `lib/cgraph/cgraph.h` to
TypeScript classes. The `agbindrec`/`AGDATA` mechanism is eliminated per AD-1;
layout data is held directly on `GraphInfo`/`NodeInfo`/`EdgeInfo` fields. Two
critical invariants from the C edge-storage model must be preserved and
documented in JSDoc.

## Task

Create TypeScript classes `Graph`, `Node`, and `Edge` in `src/model/`. Preserve
the directional semantics and adjacency-list conventions of `Agedgepair_t`
exactly. Write tests in `src/model/model.test.ts` covering the invariants listed
in the Acceptance Criteria.

## Write-Set

```
src/model/graph.ts
src/model/node.ts
src/model/edge.ts
src/model/index.ts   (update to re-export new classes)
src/model/model.test.ts
```

## Read-Set

- `~/git/graphviz/lib/cgraph/cgraph.h` — `Agraph_t`, `Agnode_t`, `Agedge_t`,
  `Agedgepair_t`, `Agdesc_t` structs and the `AGTAIL`/`AGHEAD`/`AGOUT2IN`/
  `AGIN2OUT` macro semantics
- `~/git/graphviz/docs/architecture/lib/cgraph.md` — Edge Direction Semantics
  section, Subgraph Ownership Semantics section
- `~/git/graphviz/docs/architecture/typescript-port.md` — Layer 1 type mapping

## Architecture Decisions

- AD-1: agbindrec/GD_*/ND_*/ED_* → typed fields. The `hdr Agrec_t`, `mtflock`,
  `AGDATA`, and circular-record-list machinery are not translated. Each class
  holds `info: GraphInfo | NodeInfo | EdgeInfo` directly.
- AD-5: cgraph++ RAII wrappers not ported.

## Interface Contracts

### GraphKind

```typescript
// Derived from Agdesc_t in lib/cgraph/cgraph.h
export type GraphKind = 'directed' | 'undirected' | 'strict-directed' | 'strict-undirected';
```

### Graph

```typescript
export class Graph {
  readonly name: string;
  readonly kind: GraphKind;
  nodes: Map<string, Node>;          // insertion-ordered; mirrors n_seq dict
  edges: Edge[];                      // all edges owned by root graph
  subgraphs: Map<string, Graph>;     // named subgraphs
  attrs: Map<string, string>;        // string attributes (agget/agset)
  info: GraphInfo;                   // replaces GD_* macros (AD-1)
  parent: Graph | null;              // null for root graphs
  root: Graph;                       // self for root, up-pointer for subgraphs

  constructor(name: string, kind: GraphKind);
}
```

### Node

```typescript
export class Node {
  readonly id: number;               // AGID — unique per root graph
  readonly name: string;
  attrs: Map<string, string>;
  info: NodeInfo;                    // replaces ND_* macros (AD-1)
  readonly root: Graph;              // root graph that owns this node

  constructor(id: number, name: string, root: Graph);
}
```

### Edge

```typescript
// NOTE: In Agedgepair_t, the out half stores the HEAD and the in half stores
// the TAIL. This is counterintuitive but matches C: out.node == head,
// in.node == tail. See lib/cgraph/cgraph.h Agedgepair_t and the
// AGTAIL/AGHEAD macro definitions.
export class Edge {
  readonly tail: Node;    // C: AGTAIL(e) = AGMKIN(e)->node = in.node
  readonly head: Node;    // C: AGHEAD(e) = AGMKOUT(e)->node = out.node
  readonly name: string;  // edge key; empty string for anonymous edges
  attrs: Map<string, string>;
  info: EdgeInfo;         // replaces ED_* macros (AD-1)

  constructor(tail: Node, head: Node, name: string);
}
```

### Adjacency list invariant (JSDoc required on Node.outEdges and Node.inEdges)

The C `agfstedge`/`agnxtedge` API visits out-edges first, then in-edges.
Self-loops appear as out-edges only (`agnxtedge` skips them as in-edges). In
the TypeScript model, expose these edge sets as methods or getters that return
arrays obtained from `Graph.edges` filtered by `tail === this` (out) or
`head === this` (in).

**Critical JSDoc on `outEdges(g: Graph)`:**

```
/**
 * Returns the out-edges of this node in graph g.
 *
 * INVARIANT: In the C cgraph library, the adjacency list for a node begins
 * with the node's own self-loop (index 0), and neighbor traversal MUST start
 * at index 1. This convention originates from `lib/cgraph/edge.c` and
 * `agfstedge`/`agnxtedge`. In this TypeScript implementation, self-loops are
 * included in both outEdges() and the full edge list but are excluded from
 * inEdges() — matching the `agnxtedge` behavior that skips self-loops as
 * in-edges. Callers iterating over neighbors must account for self-loop edges
 * appearing in outEdges().
 */
```

### index.ts re-exports

`src/model/index.ts` must export: `Graph`, `Node`, `Edge`, `GraphKind`, and
all symbols exported by `geom.ts`.

## Acceptance Criteria

- Given a directed graph with edge A→B, when `edge.head` and `edge.tail` are
  read, then `edge.head.name === 'B'` and `edge.tail.name === 'A'`.
- Given a node with a self-loop edge, when `outEdges(g)` is called, then the
  self-loop edge appears in the result (it is an out-edge in C semantics).
- Given a node with a self-loop edge, when `inEdges(g)` is called, then the
  self-loop edge does NOT appear (C `agnxtedge` skips self-loops as in-edges).
- Given an `Edge` object, when both `edge.tail.outEdges(g)` and
  `edge.head.inEdges(g)` are inspected, then the same `Edge` instance appears
  in both results (shared object — not two copies).

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for this module (all 4 ACs have corresponding tests)
- One commit: `feat(model): add Graph, Node, Edge base classes`
