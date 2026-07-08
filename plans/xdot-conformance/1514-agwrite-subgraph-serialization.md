# 1514 — port's xdot serializer is a flattened agwrite (no per-subgraph edge re-declaration)

**Status:** Part A DONE (faithful serializer, corpus-clean); Part B (layout
membership) OPEN · **Kind:** xdot serialization fidelity (model + serializer +
layout) · **Filed:** 2026-07-07

## Update 2026-07-08 — Part A landed, Part B is the residual

**Part A (recursive agwrite serializer) is done** and corpus-clean: the flat
serializer was replaced with a faithful `write.c` port (subgdfs / write_subgs /
write_body / write_node_test / write_edge_test / attrs_written). Full survey
**752 conformant, 0 regressions**. The port's xdot now emits the full subgraph
tree with scoped nodes/edges and bare re-declarations. 1514 dropped from a
structural mismatch to a **single residual diff**.

**Part B (the residual) is a post-layout subgraph-MEMBERSHIP mismatch, not a
serialization bug.** For 1514, native's post-layout membership is: both flat
`Act_21->Act_22` edges (and `Act_22->Act_23`) hoisted into the enclosing anon
subgraph `%3` (drawn there); `%7` (rank=same inside cluster_inner) and
cluster_inner **emptied**; line-9 retains `%15` membership → agwrite re-declares
it bare there (the 3rd statement). The port's post-layout membership instead
keeps line-5 in `%7` and never adds line-9 to `%3`, so a faithful agwrite emits
2 drawn (line-5 in `%7`, line-9 in `%15`) and no bare re-declaration.

## Update 2026-07-08 — Part B mechanism pinned by C instrumentation; blocked by layout ordering

Instrumented native (traced `agsubedge`/`agdeledge`/`node_induce` + a full
post-layout membership dump, `DUMP_MEMB`). The exact native mechanism:

1. `node_induce(par, cluster_inner)` runs its second loop and calls
   `agsubedge(cluster_inner, line-9, 1)` — inducing the flat edge declared in the
   sibling `%15` into cluster_inner (both endpoints are cluster_inner members at
   that moment).
2. `installedge` (edge.c:166-186) walks **up** the ancestor chain adding the edge
   to each parent until one already has it: cluster_inner → `%3` (add) → root
   (already has it, stop). **This is how `%3` gains line-9.**
3. *Later*, the rank=same collapse sets `ranktype`, and Act_21/Act_22 are pruned
   from cluster_inner; `agdelnode`→`agapply` propagates the deletion **down** to
   cluster_inner's subgraphs, **emptying `%7`**. `%3` keeps line-9 (an ancestor,
   unaffected).

Net: `%3` = both flat edges (drawn), `%7` empty, `%15` keeps line-9 (bare
re-decl). Confirmed the port's post-layout membership differs in exactly two
places: `%3` lacks line-9; `%7` still has Act_21/Act_22.

**Two faithful port fixes were implemented and tested:**
- **A** — `induceClusterEdges` propagate up (mirror `installedge`): geometry-safe
  but a **no-op for 1514**, because the port's `nodeInduce` prunes the rank=same
  nodes from the cluster *before* inducing, so cluster_inner has no Act_21/Act_22
  to induce line-9 from. Native induces **before** `ranktype` is set (rank=same
  collapse comes later); the port sets `ranktype`/prunes first. **This is a
  layout-ORDERING difference.**
- **B** — `agDeleteFromCluster` propagate down (mirror `agdelnode`/`agapply`):
  correctly empties `%7`, but **breaks the flat-edge geometry** (1514 20 diffs,
  splines shift ~25pt). The port's flat-edge routing reads the rank=same
  subgraph's node membership; emptying it during layout changes the geometry.
  Native empties it too, but the port's routing depends on it differently.

**Conclusion: Part B is blocked by a layout-sequence entanglement.** Achieving
native's membership requires reordering the port's cluster/rank layout to
induce-before-rankset-collapse AND decoupling flat-edge routing from rank=same
subgraph membership — a substantial, high-risk layout refactor. Both were
demonstrated to either no-op or break geometry. Reverted; Part A (the faithful
serializer) stands as the delivered improvement. The residual is a single
**invisible** diff (bare `Act_21 -> Act_22;`, no draw ops, no geometry).

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
