<!-- SPDX-License-Identifier: EPL-2.0 -->

# T4 — endpoint-subgraph seq (CONTINGENT)

> **Execute only if T3 diagnosed edge-endpoint-subgraph seq drift.** If T3 is
> clean, mark this task `[x]` with note "not needed — no drift observed" and
> skip.

## Context

In DOT, `{a b} -> {c d}` creates anonymous subgraphs for each endpoint. cgraph
materializes them via `agsubg`, consuming an AGSEQ each (graph.c:82). The port's
`builder.ts:resolveEndpoint` resolves endpoint subgraphs by node-name only
(`NameCollector.fromStmts`) and never creates a `Graph`, so it does **not**
advance the subgraph counter. A cluster appearing later in source order then
gets a seq lower than the oracle's by the number of preceding endpoint
subgraphs.

C reference: the grammar reduces a subgraph endpoint through the same `agsubg`
path as a statement subgraph (`lib/cgraph/scan.l` / `grammar.y` — endpoint
subgraphs are real subgraphs).

## Task
Make endpoint subgraphs advance the subgraph seq counter in the same source
order C does. Minimal faithful options (choose per what T3's diff shows):
- **(preferred)** When `resolveEndpoint` encounters a `subgraph` item, create a
  real `Graph` for it (anon name via the existing anon-id path; nested-subgraph
  bodies handled by the same recursion), assign its seq via `assignSubgSeq`,
  install its nodes, and use it as the endpoint. This mirrors cgraph most
  closely (the endpoint subgraph also gains a correct `%N` name and seq).
- **(fallback, only if the above perturbs `%N` titles or membership)** Advance
  only the subgraph seq counter for endpoint subgraphs without materializing a
  Graph, after verifying against C that no other observable (title, membership,
  node ownership) depends on the object existing.

Verify ordering precisely against C: the endpoint subgraph is created when the
parser reduces the endpoint, **before** the edge object — check with an
instrumented oracle render (`dot -Tsvg`) on the failing T3 input and match the
exact cluster seq.

## Read-set
- `decisions.md#adr-4-edge-endpoint-subgraphs-deferred-to-a-contingent-task`
- `src/parser/builder.ts:250-280` (`resolveEndpoint`, `processEdgePair`,
  `advanceAnonId`)
- `src/parser/builder.ts:197-220` (`processSubgraph` — reuse its creation +
  `assignSubgSeq` pattern)
- The specific failing input identified by T3
- C: `~/git/graphviz/lib/cgraph/graph.c:78-95`

## Acceptance criteria
- Given the T3-failing input, when rendered, then its cluster ids match the
  oracle.
- Given the 7 original targets, when re-surveyed, then all are flipped (no
  regression from this change).
- Given a graph using `{…} -> {…}` endpoints, when checking emitted `%N` cluster
  titles and node membership, then they are unchanged from before T4 (the
  endpoint change must not perturb existing-correct titles/membership).
- Given the full survey, when compared to post-T3, then 0 net regressions.

## Tests (TDD)
- A builder/render test on the T3-failing input asserting cluster seqs/ids.
- A guard test on an existing endpoint-subgraph input confirming `%N` titles and
  membership are unchanged.

## Observability
N/A.

## Rollback
Reversible.

## Quality bar
`tsc --noEmit` exit 0; `vitest run` green; survey 0 net regressions.

## Commit
`fix(T4): seq-advance edge-endpoint subgraphs to match cgraph AGSEQ`
