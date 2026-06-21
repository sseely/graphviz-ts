# T7 — graphviz-ts/api barrel

## Context

graphviz-ts (TS port of Graphviz, ESM, strict TS). The `graphviz-ts/api` subpath
(ADR-2) is the "build + inspect + geometry" entry. This task is the barrel that
re-exports the Batch 1–2 api pieces. Keep it pure re-exports — no logic.

## Task

Create `src/api/index.ts` re-exporting the public surface of the api layer:
- builder (T4): `createGraph`, `GvGraphBuilder`, `GvNode`, `GvEdge`,
  `CreateGraphOptions`
- geometry (T3): `getLayout`, `LayoutSnapshot`, `NodeGeometry`, `EdgeGeometry`,
  `BoundsGeometry`, `YAxis`, `GeometryOptions`
- edge-ops (T2): `addEdge`

Re-export the opaque `Graph` **type** (not the class internals) so consumers can
type variables holding a builder's `.graph` / a `parse()` result. Export as a
type-only re-export to avoid leaking the class implementation.

## Write-set

- `src/api/index.ts` (create)

## Read-set

- `src/api/builder.ts` (T4), `src/api/geometry.ts` (T3), `src/api/edge-ops.ts`
  (T2) — the exports to surface
- `src/model/graph.ts` — `Graph` (for `export type { Graph }`)

## Architecture decisions

ADR-1 (type-only `Graph`, no class internals), ADR-2.

## Interface contract (output)

Module `graphviz-ts/api` (built to `dist/api.js`) exporting all of the above.

## Acceptance criteria

- Given `import { createGraph, getLayout, addEdge } from '<api>'`, then all
  resolve (verified by T9's entry test).
- Given the barrel, then no internal mutable class (`Graph`/`Node`/`Edge` as
  values) is exported — only `export type { Graph }`.

## Observability / Rollback

N/A. Rollback: Reversible (new file).

## Quality bar

`npm run typecheck` exit 0. One commit: `feat(api): add api entry barrel`.
