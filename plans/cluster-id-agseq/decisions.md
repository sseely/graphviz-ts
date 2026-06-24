<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture decisions

## ADR-1: Subgraph-seq counter lives on the root Graph
- **Context:** C stores the subgraph counter in `clos->seq[AGRAPH]` on the root
  (`agnextseq`, graph.c:152). Two port creation paths exist: the parser
  (`builder.ts:processSubgraph`, `new Graph` directly) and the public API
  (`cgraph-ops.ts:agsubg`).
- **Decision:** Add the mutable counter to the root `Graph` and a free helper
  `assignSubgSeq(parent, sg)` that sets `sg.seq = ++rootOf(parent).<counter>`.
  Call it from both creation paths.
- **Consequences:** One source of truth, faithful to `clos`. A builder-local
  counter would miss the public-API path and drift from C. Layout-time
  `new Graph` (rank/splines/fdp) never needs a seq; default 0 is harmless
  (those graphs are never emitted as clusters).

## ADR-2: Root graph has seq 0
- **Context:** C creates the root with `par == NULL`, so it never calls
  `agnextseq` and keeps the default 0 → `getObjId` emits `graph0`.
- **Decision:** `Graph.seq` defaults to 0; the root is never seq-assigned. The
  first created subgraph gets seq 1.
- **Consequences:** Matches `graph0` (already correct) and the `clustN` base.

## ADR-3: Retire `job.clusterId` entirely
- **Context:** The dense counter is read only by `svg-cluster.ts`
  (`job.clusterId++`) and consumed by `svgClusterId`.
- **Decision:** Remove the `clusterId` field (job.ts) and its increment
  (svg-cluster.ts) once `svgClusterId` reads `sg.seq`. Dead-code policy.
- **Consequences:** No dead counter. Reversible.

## ADR-4: Edge-endpoint subgraphs deferred to a contingent task
- **Context:** `{a b} -> {c d}` endpoint subgraphs are real subgraphs in
  cgraph (they consume an AGSEQ). The port's `resolveEndpoint` resolves them by
  name only and never materializes a Graph, so a later cluster's seq could
  drift. The 7 confirmed targets use plain-node endpoints (no drift).
- **Decision:** Ship the core fix first (T1–T2). T3's survey is the detector:
  if a target fails to flip, or a guard regresses, due to endpoint-subgraph
  drift, port the seq-advance in T4. C-is-sacred is satisfied — we port the
  branch when a real corpus case exercises it, rather than speculatively.
- **Consequences:** Minimal first change; survey-gated escalation. Rollback:
  Reversible (pure code).

## Rollback classification
All tasks: **Reversible** — pure in-memory model + render changes, no schema,
no persisted format. Revert the commits.
