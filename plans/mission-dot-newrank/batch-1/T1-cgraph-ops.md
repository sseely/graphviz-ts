# T1 — Port cgraph subgraph/node primitives

## Context

graphviz-ts is a faithful TS port of graphviz C (`~/git/graphviz`). DOT-3's
`fillRanks` needs to create a `_new_rank` subgraph and add anonymous placeholder
nodes (AD-1). The model already has subgraph infrastructure (`Graph.subgraphs`
map, `parent`, `root`) but the cgraph operations are not exported as functions.

## Task

Port these cgraph ops into a new `src/model/cgraph-ops.ts`, mirroring C cgraph
semantics:
1. `agnode(g, name, create)` — create-or-get a node; when `name` is null/empty,
   mint a fresh anonymous node. Honour create flag.
2. `agsubg(parent, name, create)` — create-or-get a named subgraph under
   `parent`; set `parent`/`root`; register in `parent.subgraphs`. Return null
   when `create=0` and absent.
3. `agsubnode(g, n, create)` — make `n` a member of subgraph `g` AND every
   enclosing graph up to root (Subgraph Ownership Semantics — see memory
   `cgraph.md`). Nodes are owned by the root graph.
4. `agdelnode(g, n)` — remove `n` from `g` and its member graphs.
5. `agdelsubg(parent, sg)` — remove subgraph `sg` from `parent`.

Do NOT change existing `Graph`/`Node` signatures — add functions only.

## Write-set

- `src/model/cgraph-ops.ts` — the five primitives
- `src/model/cgraph-ops.test.ts` — unit tests

## Read-set

- `decisions.md#ad-1`
- `src/model/graph.ts` (subgraphs/parent/root fields, ownership comment ~31-40)
- `src/model/node.ts` (Node shape)
- memory `cgraph.md` (Subgraph Ownership Semantics)
- `~/git/graphviz/lib/cgraph/` (`subg.c:agsubg`, `node.c:agnode`, `subg`/`obj`
  deletion) for exact semantics

## Interface contract (consumed by T3, T4)

```
agsubg(parent: Graph, name: string, create: boolean): Graph | null
agsubnode(g: Graph, n: Node, create: boolean): Node
agnode(g: Graph, name: string | null, create: boolean): Node
agdelnode(g: Graph, n: Node): void
agdelsubg(parent: Graph, sg: Graph): void
```

## Acceptance criteria

- **Given** a root graph, **when** `agsubg(root,"_new_rank",true)`, **then** a
  registered subgraph is returned and `agsubg(root,"_new_rank",false)` re-finds
  it (same object).
- **Given** a node added via `agsubnode(sg, n, true)`, **then** `n` is a member
  of `sg` AND every enclosing graph including root.
- **Given** `agdelnode(g, n)`, **then** `n` is absent from all member graphs.
- **Given** `agdelsubg(parent, sg)`, **then** `agsubg(parent, sg.name, false)`
  returns null.
- **Given** the 115 goldens, **then** all byte-identical (additive change).

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates.
Commit: `feat(T1): port cgraph subgraph/node ops for newrank fill nodes`.

## Observability / Rollback

N/A — no new observable operations. Reversible (revert; additive, goldens
byte-identical).
