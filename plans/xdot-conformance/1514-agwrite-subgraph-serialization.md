# 1514 — port's xdot serializer is a flattened agwrite (no per-subgraph edge re-declaration)

**Status:** ROOT-CAUSED · **Kind:** xdot serialization fidelity (model +
serializer) · **Filed:** 2026-07-07

## Symptom

`dot -Txdot tests/1514.dot`: native emits **3** `Act_21 -> Act_22` edge
*statements*, the port emits **2**. The comparator reports the missing 3rd as
`edge:Act_21->Act_22#2[missing-object]`.

Native's 3:
- two **drawn** (with `_draw_`/`pos`) in the outer subgraph
- one **undrawn** — bare `Act_21 -> Act_22;` — inside the top-level
  `{rank=same}` subgraph

## Input

```dot
digraph {
  {
    Act_1 -> Act_3;
    subgraph cluster_inner {
      {Act_21 -> Act_22; rank=same;}     // edge declared in a rank=same subgraph
      Act_22 -> Act_23;
    }
  }
  Act_3 -> Ex	{Act_21 -> Act_22; rank=same;}   // a 2nd rank=same subgraph
}
```

The model has exactly **2** `Act_21->Act_22` edge objects — confirmed three ways:
`gvpr` (2), `dot -Tplain` (2 edges), `dot -Tcanon` (2). The port's post-layout
model agrees: 2 edge objects, both with splines.

## Root cause (CONFIRMED)

Not a missing edge object — a **serialization** difference. Native's `agwrite`
emits each edge in *every subgraph it is a member of*; the port emits every edge
**once, flat, at the root**.

**Native (`lib/cgraph/write.c`):**
- `write_subgs` (434) recurses the full subgraph tree; `write_body` (625) writes
  a subgraph's own nodes/edges scoped by subgraph preorder number
  (`write_edge_test`, 595).
- `write_edge` (615-619) writes attributes only the **first** time an edge is
  emitted; on any later emission (`attrs_written(e)` true) it writes just the
  bare name:
  ```c
  if (!attrs_written(e)) write_nondefault_attrs(e, ...);   // Act_21 -> Act_22 [_draw_=...]
  else                   write_edge_name(e, ...);          // Act_21 -> Act_22;
  ```
  So an edge that belongs to two subgraph scopes is emitted **drawn once + bare
  (undrawn) once** — exactly the observed 3rd statement.

**Port (`src/render/dot.ts:serialize`, 1013):**
```ts
for (const sg of this.clustersWithDraw(g)) { /* emit CLUSTERS only, flat, no body */ }
for (const n of this.allNodes(g))          { /* all nodes, flat at root */ }
for (const e of g.edges)                   { /* all edges, flat at root, once each */ }
```
It is a **simplified flat agwrite**: it emits only clusters (as empty
`subgraph cluster_X { graph[...]; }` shells), then every node and every edge once
at the root. It does not:
1. emit anonymous / `rank=same` subgraphs,
2. scope nodes/edges into their subgraphs, or
3. re-declare an edge in additional subgraph scopes.

Correspondingly, the port's model does not track edge membership in non-cluster
subgraphs (probe: the two child subgraphs report **0** `Act_21->Act_22` members,
while both edges sit at root). Native keeps each edge a member of its declaring
`rank=same` subgraph, which is what drives the extra bare emission.

For most corpus graphs the flat form is byte-equivalent to agwrite's output, so
the simplification is invisible; 1514 exposes it because two edges are declared
inside `rank=same` subgraphs.

## Why it is NOT layout or emission-geometry

- The drawn geometry matches: SVG drawn edges native=5, port=5; the two drawn
  `Act_21->Act_22` splines are byte-identical.
- The 3rd statement carries **no geometry** (bare `Act_21 -> Act_22;`) — it is a
  structural re-declaration, invisible in SVG (which never emits it).

## Fix (large; deferred)

Replace the flat `serialize` with a faithful recursive `agwrite` port:
`write_subgs` / `write_body` / `write_edge_test` (subgraph preorder) /
`write_node_test` / `attrs_written` re-emission — plus model support for edge
(and node) membership in non-cluster subgraphs. This would fix 1514 and make the
port's xdot structurally faithful for every graph with meaningful subgraph
nesting, but it is a cross-cutting change to the graph model + serializer, well
beyond a draw-op fix. Not attempted here.

## Repro

```sh
DOT=~/git/graphviz/build/cmd/dot/dot
GVBINDIR=/tmp/ghl $DOT -Txdot tests/1514.dot | grep -c 'Act_21 -> Act_22'      # native: 3
npx tsx test/corpus/render-one-xdot.ts tests/1514.dot | grep -c 'Act_21 -> Act_22'  # port: 2
```
