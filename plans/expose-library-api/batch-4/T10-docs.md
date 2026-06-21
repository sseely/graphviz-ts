# T10 — Capability guide pages

## Context

graphviz-ts now exposes (after Batch 3) programmatic construction, geometry
readout, multi-format rendering, and xdot draw-ops via `graphviz-ts/api` and
`graphviz-ts/render`. Docs are built with VitePress (`docs-site/`,
`npm run docs:build`). Document the new capabilities for library consumers
(primary consumer: plantuml-js).

## Task

Add guide pages and register them in the VitePress sidebar/nav:
1. **Build a graph in code** — `createGraph`, `addNode`/`addEdge`/`addSubgraph`,
   attributes; contrast with `parse(dot)`.
2. **Read computed geometry** — `getLayout`, the snapshot shape, the `yAxis`
   option (default screen y-down vs native y-up), units.
3. **Render to other formats** — `render(graph, format)`, the `OutputFormat`
   list, when to use dot/xdot/json/plain/imap/cmapx.
4. **Custom rendering with xdot draw-ops** — `getDrawOps`, switching on op kinds
   to draw on canvas/WebGL/PDF.

Each page: a short intro + a minimal runnable code sample using the real public
API. Verify code samples compile against the built types.

## Write-set

- `docs-site/guide/*.md` (new pages — exact paths per existing structure)
- the VitePress config that defines the sidebar (modify to register pages)

## Read-set

- `ls docs-site` then the VitePress config + an existing guide page for
  structure/voice
- `src/api/index.ts`, `src/render/index.ts` — the exact public symbols to document

## Architecture decisions

Reflect ADR-3 (snapshot), ADR-4 (yAxis default down), ADR-5 (formats), ADR-6
(builder). Do not document `pack`/`pathplan` (ADR-7, deferred).

## Acceptance criteria

- Given the docs build (`npm run docs:build`), then it exits 0 with the new
  pages included.
- Given each page, then its code sample uses only public exports and is accurate
  to the shipped signatures.
- Given the sidebar, then all four pages are reachable.

## Observability / Rollback

N/A. Rollback: Reversible (docs only).

## Quality bar

`npm run docs:build` exit 0. One commit: `docs(api): document library API
capabilities`.
