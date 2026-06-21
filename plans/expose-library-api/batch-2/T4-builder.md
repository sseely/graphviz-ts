# T4 — Graph builder + typed node/edge handles

## Context

graphviz-ts (TS port of Graphviz, ESM, strict TS, vitest). Today the only way to
get a graph is `parse(dotSource)`. This task adds idiomatic **programmatic
construction** so consumers can build a graph in TS without emitting DOT. Per
ADR-1 we do NOT re-export the internal mutable `Graph`/`Node`/`Edge` classes;
instead the builder returns lightweight typed handles that wrap internal refs.

## Task

Implement `createGraph(opts)` returning a builder. Back it with the existing
internal model: `new Graph(name, kind)`, `agnode`/`agsubg` from
`model/cgraph-ops.ts`, and `addEdge` from T2 (`src/api/edge-ops.ts`).

Public handle types `GvNode`/`GvEdge` carry identity + `setAttr`/`getAttr` and an
internal (non-enumerable / clearly internal) ref. `addEdge` accepts either a
`GvNode` handle or a node name string (resolve to handle).

The builder must expose the underlying `Graph` for handoff to `layout`/`render`/
`getLayout` (e.g. a `.graph` accessor returning the opaque `Graph`), since those
APIs operate on `Graph` (ADR-1).

## Write-set

- `src/api/builder.ts` (create)
- `src/api/builder.test.ts` (create)

## Read-set

- `src/api/edge-ops.ts` — `addEdge` (T2 output; read its signature)
- `src/model/cgraph-ops.ts:53-104` — `agnode`, `agsubg`, `agsubnode`
- `src/model/graph.ts:24-106` — `GraphKind`, `Graph` ctor, `attrs`,
  `nodeDefaults`, `edgeDefaults`
- `src/model/node.ts:27-67`, `src/model/edge.ts:35-87` — what handles wrap
- `src/parser/builder.ts` — reference for correct kind/strict/directed mapping

## Architecture decisions

ADR-1 (no internal-class leak), ADR-6 (typed handles), ADR-8 (string attrs).
`GraphKind` mapping: `{directed, strict}` → the correct `GraphKind` enum/string.

## Interface contract (output)

```ts
export interface CreateGraphOptions { directed?: boolean; strict?: boolean; name?: string; }
export interface GvNode { readonly name: string; setAttr(k: string, v: string): void; getAttr(k: string): string | undefined; }
export interface GvEdge { readonly tail: string; readonly head: string; setAttr(k: string, v: string): void; getAttr(k: string): string | undefined; }
export interface GvGraphBuilder {
  addNode(name: string, attrs?: Record<string, string>): GvNode;
  addEdge(tail: GvNode | string, head: GvNode | string, attrs?: Record<string, string>): GvEdge;
  addSubgraph(name: string, attrs?: Record<string, string>): GvGraphBuilder;
  setAttr(k: string, v: string): void;
  getAttr(k: string): string | undefined;
  readonly graph: Graph; // opaque handle for layout/render/getLayout
}
export function createGraph(opts?: CreateGraphOptions): GvGraphBuilder;
```

## Acceptance criteria

- Given `createGraph({directed:true})` + `addNode('a')`/`addNode('b')`/
  `addEdge('a','b')`, then `.graph` is a `Graph` whose serialization equals
  parsing `digraph { a -> b }` (structural parity).
- Given `addEdge(nodeA, nodeB)` with handles, then it type-checks and resolves to
  the same nodes as the string form.
- Given `addSubgraph('cluster_0')` + `addNode` on it, then the node is in the
  subgraph and the root (cgraph membership).
- Given `setAttr` on a node handle, then `getAttr` returns it and it serializes.
- Given `.graph` handed to `render(...)` (T5) with `dot`, then it renders without
  error.

## Observability / Rollback

N/A. Rollback: Reversible (new files only).

## Quality bar

`npm run typecheck && npm test && npm run build` exit 0. Tests assert structural
parity vs `parse`. One commit: `feat(api): add programmatic graph builder`.
