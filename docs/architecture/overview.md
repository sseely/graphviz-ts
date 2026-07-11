<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture Overview

## Index

- [overview.md](./overview.md) — this document
- [inventory.md](./inventory.md) — per-repo runtime/stack inventory
- [tech-health.md](./tech-health.md) — version EOL and CVE status
- [architecture.md](./architecture.md) — system architecture diagram
- [components.md](./components.md) — per-repo internal component diagrams
- [data-flow.md](./data-flow.md) — sequence diagrams for key flows

## What the system does

`graphviz-ts` is a **faithful, pure-TypeScript port of Graphviz**, the
graph-visualization toolkit originally written in C. It takes a graph described
in the DOT language, runs one of Graphviz's eight layout engines to compute node
and edge geometry, and emits a rendered diagram — primarily SVG, with `json`,
`dot`, `xdot`, `plain`, `imap`, and `cmapx` also supported.

Its defining property is that it is **pure TypeScript with zero runtime
dependencies and no browser-hostile APIs** (no `fs`, no native binary, no WASM).
This lets it run unchanged in a browser or in Node. The explicit correctness
goal is **conformance** with the C implementation — the dot engine matches the C
binary within a tight deterministic tolerance (±0.01 on numeric coordinates,
exact non-numeric content), not literal byte-for-byte output (see
[conformance.md](../conformance.md)). The C source is treated as the canonical
specification.

## How the repos relate

```
graphviz (C, canonical spec)
        │ ported module-by-module
        ▼
   graphviz-ts
   (this repo)
```

- **graphviz (C)** is the upstream specification. Each C module
  (`cdt`, `cgraph`, `dotgen`, `neatogen`, …) is ported into a matching
  TypeScript module under `src/`. Behavior, function boundaries, and even odd
  edge-case branches are preserved deliberately, validated against the native C
  binary as an oracle.
- **graphviz-ts** is the port itself: this repository. The `dot` engine
  receives the most fidelity attention because downstream consumers depend
  on it, which makes `dot`-engine fidelity the top correctness priority for
  this project.

## Key data flows

1. **DOT string → SVG** (primary): parse DOT → build graph model → run layout
   engine (geometry) → render to SVG. See [data-flow.md](./data-flow.md).
2. **Programmatic graph → geometry snapshot**: `createGraph` / `addEdge` build a
   graph in code, `render()` computes layout, `getLayout()` returns a geometry
   snapshot (with the Y-axis flipped to screen coordinates).
3. **Layout → draw-ops**: `getDrawOps()` exposes per-object xdot draw operations
   for callers that want to render with their own backend instead of the
   built-in SVG emitter.

## Tech stack summary

| Repo | Language | Runtime | Framework | Database | External deps |
|------|----------|---------|-----------|----------|---------------|
| graphviz-ts | TypeScript (ES2022, strict) | Node 26.3.1 + browser | none | — | none at runtime (esbuild/vitest/peggy dev-only) |
| graphviz | C | native | none | — | autotools/libgvc |

See [tech-health.md](./tech-health.md) for EOL and CVE status of each version.
