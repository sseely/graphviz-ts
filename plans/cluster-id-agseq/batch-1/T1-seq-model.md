<!-- SPDX-License-Identifier: EPL-2.0 -->

# T1 — subgraph AGSEQ counter + `Graph.seq`

## Context

graphviz-ts is a faithful TypeScript port of C graphviz; the C source at
`~/git/graphviz` is the spec. Cluster SVG ids come from `getObjId`
(`lib/common/emit.c:230`): `clust<AGSEQ(subgraph)>`. `AGSEQ` for a subgraph is a
**global counter on the root graph**, assigned at creation in source order:

```c
// lib/cgraph/graph.c:82 (agsubg → agopen path)
if (par) { uint64_t seq = agnextseq(par, AGRAPH); AGSEQ(g) = seq & SEQ_MASK; ... }
// lib/cgraph/graph.c:152
uint64_t agnextseq(Agraph_t *g, int objtype) { return ++(g->clos->seq[objtype]); }
```

Root has `par == NULL` → keeps seq 0. First subgraph created → 1, second → 2, …
counting **anonymous** subgraphs. Worked example (`nestedclust.gv`):

```
digraph G {                                              // root  seq 0  -> graph0
  subgraph {e->f subgraph cluster_ss81 {a->b->c}};       // anon  seq 1
                                  // cluster_ss81         //       seq 2  -> clust2
  subgraph { subgraph { subgraph { subgraph cluster_x {   // anon  seq 3,4,5
                  x; subgraph cluster_y {y }}}}}          // cluster_x seq 6 -> clust6
}                                                         // cluster_y seq 7 -> clust7
```

Oracle emits `clust2, clust6, clust7`; the port today emits `clust1,2,3` from a
dense `job.clusterId++`. This task ports the **counter and the per-graph seq**;
T2 consumes it in emission.

The port already tracks subgraph creation in source order (parser
`processSubgraph` recurses depth-first; `builder.ts:130` documents a separate
`anonCounter` for `%N` names — do **not** reuse it, AGSEQ counts subgraphs only).

## Task

1. Add a `seq: number` field to `Graph` (default `0`; the root's value).
2. Add the root-level subgraph counter mirroring `clos->seq[AGRAPH]`. Store it
   on the root `Graph` (e.g. a field `subgSeqCounter = 0`, meaningful only on
   the root). Add a free helper in `cgraph-ops.ts`:
   `assignSubgSeq(parent: Graph, sg: Graph): void` that sets
   `sg.seq = ++parent.root.subgSeqCounter`. (`parent.root` is the root; the root
   is self-referential per graph.ts.)
3. Wire it into **both** creation paths so they share the counter:
   - Parser: `builder.ts:processSubgraph` — call `assignSubgSeq(graph, sg)`
     immediately after `sg.root = root` and **before** `buildGraph(stmt.stmts …)`
     recurses (so the parent's seq is assigned before its children — matching C,
     which calls `agnextseq` when the subgraph opens, before its body).
   - `cgraph-ops.ts:agsubg` — call `assignSubgSeq(parent, subg)` after
     `subg.root = parent.root`, in the `create` branch only (existing subgraphs
     keep their seq).
4. Do **not** assign a seq to the root graph (`builder.ts` root creation,
   `agopen`/`new Graph` at builder.ts:315 and api/builder.ts:242) — it stays 0.

## Read-set
- `decisions.md#adr-1-subgraph-seq-counter-lives-on-the-root-graph`,
  `decisions.md#adr-2-root-graph-has-seq-0`
- `src/model/graph.ts:1-110` (class shape, constructor)
- `src/model/cgraph-ops.ts:80-95` (`agsubg`)
- `src/parser/builder.ts:197-220` (`processSubgraph`), `:125-160` (anon counter
  context — for contrast, not reuse)
- C: `~/git/graphviz/lib/cgraph/graph.c:78-95,150-155`

## Interface contract (consumed by T2)
```
Graph.seq: number   // AGSEQ; 0 for root, 1-based for subgraphs in creation order
```

## Acceptance criteria
- Given `nestedclust.gv` parsed, when reading the three cluster subgraphs'
  `seq`, then they are `2`, `6`, `7` (`cluster_ss81`, `cluster_x`, `cluster_y`).
- Given `graphs/clust1.gv` (two named clusters, no anon interleave), when
  reading cluster seqs, then they are `1`, `2`.
- Given the root graph of any parse, when reading `root.seq`, then it is `0`.
- Given a subgraph looked up a second time via `agsubg(parent, name, false)` (or
  a repeated named subgraph in DOT), when reading its `seq`, then it is
  unchanged from first creation (no double-increment).

## Tests (TDD — write first, in `src/parser/builder.test.ts`)
- Parse each fixture above via the existing parse/build entrypoint; walk
  `root.subgraphs` (recursively) and assert `seq`. Use real corpus inputs by
  string literal or read from `~/git/graphviz/tests` if the test already does so;
  otherwise inline the minimal DOT.

## Observability
N/A — library, no runtime observable operations.

## Rollback
Reversible — revert the commit.

## Quality bar
- `npx tsc --noEmit --stableTypeOrdering` exit 0.
- `npx vitest run` green (new + existing).
- Keep functions ≤500 lines / CCN ≤10 (complexity hook); `assignSubgSeq` is
  trivial. Every new symbol carries a `@see` C-origin JSDoc.

## Commit
`feat(T1): assign subgraph AGSEQ seq from a root-level counter`
