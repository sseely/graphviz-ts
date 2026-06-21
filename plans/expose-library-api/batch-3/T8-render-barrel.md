# T8 — graphviz-ts/render barrel

## Context

graphviz-ts (TS port of Graphviz, ESM, strict TS). The `graphviz-ts/render`
subpath (ADR-2) is the "output formats + draw-ops" entry. This task is the barrel
re-exporting the Batch 2 render pieces.

## Task

Create or extend `src/render/index.ts` to re-export the public render surface:
- `render` (T5): `render`, `OutputFormat`, `RenderOptions`
- xdot (T6): `getDrawOps`, `DrawOpsOptions`, and the xdot op types
  (`Xdot`, `XdotOp`, `XdotColor`)

**FIRST**: run `ls src/render/index.ts`. If it exists, MODIFY it additively (it
may already export renderer factories); do NOT remove existing exports — note the
pre-existing content in the decision journal. If absent, create it.

## Write-set

- `src/render/index.ts` (create or modify — confirm at start)

## Read-set

- `src/render/public.ts` (T5), `src/render/xdot-public.ts` (T6) — exports to
  surface
- existing `src/render/index.ts` if present — preserve its exports

## Architecture decisions

ADR-2, ADR-5.

## Interface contract (output)

Module `graphviz-ts/render` (built to `dist/render.js`) exporting `render`,
`OutputFormat`, `getDrawOps`, and xdot op types.

## Acceptance criteria

- Given `import { render, getDrawOps } from '<render>'`, then both resolve
  (verified by T9's entry test).
- Given a pre-existing `src/render/index.ts`, then its prior exports still
  resolve after this change.

## Observability / Rollback

N/A. Rollback: Reversible (additive re-exports).

## Quality bar

`npm run typecheck` exit 0. One commit: `feat(render): add render entry barrel`.
