# Architecture decisions — ortho P3 (dot dispatch)

## ADR-1 — Dot-local ortho adapter (not a shared extraction)
- **Context:** TS `orthoEdges(og: OrthoGraph, ...)` takes a pre-built
  `OrthoGraph` (a TS-only decoupling C lacks). Neato builds it via a private
  `OrthoHelper` (`neato/splines.ts:247`).
- **Decision:** dot gets its **own** `src/layout/dot/ortho-adapter.ts`
  (`buildOrthoGraph(g)` + `installResult`/`clipAndInstall` into `Edge.info.spl`).
  Do **not** extract/refactor neato's `OrthoHelper`.
- **Consequence:** zero churn to the working neato path; dot owns its
  spline-install context (mirrors C's separate `dotsplines.c` vs
  `neatosplines.c` call sites). ~15 lines of `buildGraph` duplication accepted.

## ADR-2 — Edge labels: position, do not route around (C parity)
- **Context:** `ortho.c:1196-1199` — `orthoEdges` warns and forces
  `useLbls=false`; **C never routes edges around edge labels.**
- **Decision:** when `EDGE_LABEL` present, position labels via the existing
  `placeRegularEdgeLabels`/`placeVnlabel` (add a thin `setEdgeLabelPos` wrapper
  only if the `ND_alg` non-adjacent-flat-edge case is missing), then dispatch
  `orthoEdges(g, true)` (which warns + downgrades). Edges may cross labels.
- **Consequence:** faithful to native `dot`. Routing-around-labels is explicitly
  **out of scope** (does not exist in C). Inventing it ⇒ STOP.

## ADR-3 — Correctness bar = SVG-golden vs native C; drill on failure
- **Context:** `maze`/`partition`/`ortho-route` are not yet oracle-pinned
  (only P1's bottom layer is).
- **Decision:** the bar is TS `dot -Tsvg` == native C `dot -Tsvg` for ortho
  fixtures (deterministic tolerance). Only drill into `maze`/`partition` with the
  P1 tiny-harness recipe when a golden diverges, then apply faithful fixes.
- **Consequence:** focused, end-goal-correct, reactive. Risk: a deep divergence
  could hit the consecutive-fix stop rule — bounded by a stop condition.

## ADR-4 — Behavior change scoped to `splines=ortho`; reversible
- **Context:** today `splines=ortho` under dot silently falls through to regular
  routing.
- **Decision:** the new dispatch branch only fires for `EDGETYPE_ORTHO`. All
  non-ortho paths are untouched; **any existing non-ortho golden/test change is a
  STOP.** No feature flag (attr-gated by `splines=ortho`).
- **Consequence:** **Reversible** — revert the branch to restore prior behavior.
  No data/schema/migration.

## ADR-5 — Mirror `dot_splines_` dispatch exactly
- **Context:** `dotsplines.c:251-259` dispatches ortho early (after the
  `EDGETYPE_NONE` check, before `mark_lowclusters`) and `goto finish`.
- **Decision:** place the TS branch identically in `dotSplines_`; in `finish`,
  **skip `routesplinesterm`** for ortho (C guards it at `dotsplines.c:461`), set
  `edgeLabelsDone=true`, return 0.
- **Consequence:** byte-faithful control flow; no regular-routing side effects
  leak into the ortho path.

## Number / type mapping
- Reuse existing dot `Graph`/`Node`/`Edge` types and `Edge.info.spl` for output.
- `OrthoGraph`/`OrthoEdge`/`OrthoPoint` already defined in `src/ortho/index.ts`.

## Rollback
- **Fully reversible.** Revert the dispatch branch + adapter + new goldens. No
  migration, no API/schema/data change. Existing non-ortho output unchanged.
