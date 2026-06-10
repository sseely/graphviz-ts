# T2 — Run engine cleanup after render (match C pipeline)

## Context
C: gvLayoutJobs (layout) → gvRenderJobs (render) → gvFreeLayout
(engine cleanup). TS `GvcContext.layout()` calls `engine.cleanup(g)`
immediately, so render sees destroyed layout state. osage is the first
engine whose cleanup clears render-needed state (info.clust/n_cluster
→ no cluster boxes); dot survives only because dotCleanup is
non-destructive for emit.

## Task
1. `src/gvc/context.ts`: `layout()` runs layout only; add
   `freeLayout(g, engineName)` (or store the engine) that calls
   `engine.cleanup(g)`. JSDoc: @see lib/gvc/gvlayout.c:gvLayoutJobs,
   gvFreeLayout.
2. `src/index.ts` renderSvg: layout → render → freeLayout.
3. `src/gvc/context.test.ts`: expectation `['layout','cleanup']` after
   ctx.layout encodes the bug — split into layout-only + freeLayout
   assertions (decision D5; journal entry).

## Write-set
src/gvc/context.ts, src/index.ts, src/gvc/context.test.ts —
OUTSIDE the mission write-set: push-forward as "obvious bug in
already-ported shared code, with suite-green proof"; journal entry
required.

## Acceptance criteria
- Given osage-simple, when rendered, then the SVG contains two
  `class="cluster"` polygon groups (was zero)
- Given the full suite, then failure count ≤ 44 and no previously
  passing test fails (all 11 dot goldens green)

## Commit
`fix(gvc): run engine cleanup after render, matching C gvFreeLayout`
