# T2 — Safe addEdge helper

## Context

graphviz-ts (TS port of Graphviz, ESM, strict TS, vitest). `model/cgraph-ops.ts`
provides `agnode`, `agsubg`, `agsubnode`, `agdelnode`, `agdelsubg` — but there is
**no** safe edge-creation helper (no `agedge` equivalent). Edges are currently
created only inside the parser: `parser/builder.ts:233` does
`new Edge(tail, head, '')` then pushes onto BOTH `root.edges` and the owning
subgraph `g.edges`, with strict-graph dedup handled separately. Programmatic
construction (T4 builder) needs a correct helper that replicates this.

## Task

Port the edge-insertion logic into a reusable `addEdge`. It must reproduce the
parser's behaviour exactly: dual-list insertion (root + owning subgraph),
strict-graph deduplication (a strict graph keeps at most one edge per
tail/head/name — return the existing edge), and correct sequence/id bookkeeping
(`Edge.graphSeq`, any id counter the parser uses).

## Write-set

- `src/api/edge-ops.ts` (create)
- `src/api/edge-ops.test.ts` (create)

## Read-set

- `src/parser/builder.ts:220-260` — the canonical insertion logic to port
- `src/model/edge.ts:35-90` — `Edge` ctor, `graphSeq`, `attrs`
- `src/model/cgraph-ops.ts:53-137` — existing op style to match
  (`agnode`/`agsubnode` signatures, create-flag pattern)
- `src/model/graph.ts:43-106` — `Graph` fields (`edges`, `root`, `kind`, strict)
- `src/parser/index.ts:230` — `serializeEdges` (round-trip reference)

## Architecture decisions

ADR-6 (decisions.md#adr-6). Match the cgraph-ops idiom. Do NOT change
`parser/builder.ts` (if shared logic emerges, T2 may export a helper the parser
*could* later adopt, but do not refactor the parser in this task).

## Interface contract (output)

```ts
export function addEdge(
  g: Graph, tail: Node, head: Node, name?: string,
): Edge // creates + inserts; in a strict graph returns the existing edge if any
```

## Acceptance criteria

- Given a strict graph and a duplicate (tail,head,name), when `addEdge` twice,
  then exactly one `Edge` exists and the second call returns the first.
- Given a non-strict graph, when `addEdge` twice with same endpoints, then two
  distinct edges exist.
- Given a subgraph `sg` of root, when `addEdge(sg, a, b)`, then the edge appears
  in BOTH `sg.edges` and `root.edges`.
- Given a built graph, then serializing it yields the same DOT edges as parsing
  the equivalent source (round-trip parity vs `parser/builder`).

## Observability / Rollback

N/A. Rollback: Reversible (new files only; parser untouched).

## Quality bar

`npm run typecheck && npm test && npm run build` exit 0. Tests assert concrete
edge counts and identity. One commit: `feat(api): add safe addEdge helper`.
