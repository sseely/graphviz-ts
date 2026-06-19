# T1 — Dot ortho dispatch + dot-local adapter + resetRW (no labels)

## Context
Faithful TS port project (root `CLAUDE.md`; C is the spec). `splines=ortho` is
parsed but never dispatched by the dot engine, so it falls through to regular
spline routing. Wire the no-edge-label case: dispatch `orthoEdges` from
`dotSplines_` exactly as `lib/dotgen/dotsplines.c:dot_splines_` does. The
`orthoEdges` pipeline already exists (`src/ortho/index.ts`); neato already
dispatches it (`src/layout/neato/splines.ts:328-331`, the reference). Tests:
**vitest**; TS strict; no Node-only APIs in `src/`.

## Task
1. **Dot-local adapter** `src/layout/dot/ortho-adapter.ts` (ADR-1): mirror
   `neato/splines.ts:OrthoHelper.buildNodes/buildEdges/buildGraph` — build an
   `OrthoGraph` from the dot `Graph` (node bb from `coord`/`lw`/`rw`/`ht`; edges
   tail≠head tagged with their source `Edge`). Provide an install callback that
   calls dot's `clipAndInstall(origEdge, origEdge.head, pts, pts.length, SINFO)`
   writing into `Edge.info.spl`.
2. **`resetRW`** port (`dotsplines.c:187-193`): for each node with
   `ND_other(n).list`, swap `rw`↔`mval`. Faithful; mostly a no-op without
   label/flat virtual nodes.
3. **Dispatch branch** in `dotSplines_` (`splines.ts:397`), placed after the
   `EDGETYPE_NONE` check and **before** `markLowclusters`, mirroring
   `dotsplines.c:251-259` for the no-label case: `resetRW(g)`;
   `orthoEdges(buildOrthoGraph(g), false, installCb)`; then the **finish**
   semantics (`dotsplines.c:461-475`): skip `routesplinesterm`, set
   `g.info.edgeLabelsDone = true`, `return 0`. (Edge-label sub-case is T2.)

## Write-set
- `src/layout/dot/ortho-adapter.ts` (create)
- `src/layout/dot/splines.ts` (modify — add branch + `resetRW`)
- `src/layout/dot/ortho-dispatch.test.ts` (create)

## Read-set
- `~/git/graphviz/lib/dotgen/dotsplines.c:228-262` (dispatch), `:187-193`
  (`resetRW`), `:461-475` (finish)
- `src/layout/neato/splines.ts:247-280` (`OrthoHelper` reference), `:328-331`
- `src/ortho/index.ts:96+` (`orthoEdges` signature, `OrthoGraph`/`OrthoEdge`/
  `OrthoPoint` types)
- `src/layout/dot/splines.ts:397-424` (`dotSplines_`/`dotSplines`)
- `decisions.md#adr-1`, `#adr-5`; one existing `src/layout/dot/*.test.ts` for the
  vitest pattern

## Architecture decisions (locked)
ADR-1 (dot-local adapter), ADR-4 (scoped to ortho; non-ortho change ⇒ STOP),
ADR-5 (mirror dispatch position + skip `routesplinesterm`). STOP on any required
deviation.

## Interface contract (consumed by T2/T3)
```ts
// src/layout/dot/ortho-adapter.ts
export function buildOrthoGraph(g: Graph): OrthoGraph;       // dot Graph -> OrthoGraph
export function installOrthoResult(oe: OrthoEdge, pts: OrthoPoint[]): void; // -> Edge.info.spl
// src/layout/dot/splines.ts (dotSplines_): adds the EDGETYPE_ORTHO branch.
```

## Acceptance criteria
- Given `splines=ortho` + a 2-node digraph (non-overlapping), when `dotSplines_`,
  then `orthoEdges` is invoked and `e.info.spl` is populated with orthogonal
  (axis-aligned segment) points — not a single straight diagonal.
- Given a graph **without** `splines=ortho`, when `dotSplines_`, then control
  flow and output are **unchanged** (regular routing; existing tests pass).
- Given `splines=ortho`, when `dotSplines_` returns, then
  `g.info.edgeLabelsDone === true` and `routesplinesterm`/regular-routing helpers
  were **not** called (assert via the absence of regular-routing side effects, or
  a spy/guard).
- Given a node with `info.other.list` set, when `resetRW`, then its `rw` and
  `mval` are swapped (matches `dotsplines.c:187-193`).

## Observability requirements
N/A — pure in-process layout; no new observable runtime operation.

## Rollback notes
**Reversible** (ADR-4). New adapter file + one dispatch branch; revert to restore
prior behavior. No migration.

## Quality bar
`npm run typecheck` 0 · `npm test` (new test passes; baseline + all existing
unchanged) · `npm run build` OK · C tree clean. The complexity hook caps
files 500 / func-lines 30 / CCN 10 / params 5 — if the branch pushes
`dotSplines_` over CCN 10, extract an `orthoDispatch(g)` helper (faithful, same
file). Return only the structured result — no preamble/summary.

## Commit
One commit: `feat(T1): dispatch splines=ortho in the dot engine (no labels)`.

## Boundaries
- **Never:** edit any non-ortho/non-dot-splines file; change regular routing;
  leave C instrumentation uncommitted; invent label routing.
- **Ask first (STOP):** an existing non-ortho test/golden would change; a faithful
  port needs a structural deviation beyond ADR-1/5; the adapter needs a dot field
  the `Graph`/`Node` type lacks.
