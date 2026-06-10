# T2 — Route all engines through shape-aware node init

## Context
T1 created `polySizeNode` (see its output interface in
poly-sizing.ts). Engines currently call `commonInitNodeEdge`
(neato/fdp/sfdp/circo/twopi) or `dotInitNodeEdge` (dot) with fixed
54×36 defaults; osage/patchwork use pack-based init. C's
`common_init_node` builds the label then runs the shape initfn for
every node in every engine.

## Task
1. In `src/common/nodeinit.ts`: `commonInitNode` builds the node label
   (text/html/record dispatch — reuse `buildNodeLabel` and
   `recordNodeInit`) and applies T1's sizing before the defaults, for
   every engine that calls it. Requires a `TextMeasurer` — thread it
   from the GVC context the same way `src/layout/dot/init.ts` does
   (`g.root.info.gvc.textMeasurer`).
2. In `src/layout/dot/init.ts`: replace `dotInitHtmlNode` +
   `sizeNodeFromLabel` with the same shared dispatcher so dot, too,
   sizes plain-text labels per C (record hook stays).
3. `src/common/poly-init.ts` (render-time): skip re-sizing when layout
   already set dimensions; keep vertex computation.
4. Verify osage/patchwork init paths also size nodes (they wrap pack;
   check their init and route through the same helper if they don't).

## Write-set
src/common/nodeinit.ts, src/common/poly-init.ts, src/layout/dot/init.ts,
(if needed, with journal entry: src/layout/osage/*, src/layout/patchwork/*
init call sites only)

## Read-set
- mission-1-node-sizing/T1 output (`src/common/poly-sizing.ts`)
- `src/layout/dot/init.ts:100-180`, `src/common/nodeinit.ts`
- `~/git/graphviz/lib/common/utils.c:common_init_node`

## Acceptance criteria
- Given the full suite, when run, then ALL 11 dot goldens still pass
- Given twopi-star, when rendered, then the first diff is no longer
  `ellipse @rx` (node sizing fixed; later diffs may remain)
- Given the full suite, when run, then failure count ≤ 44 and no
  previously passing test fails

## Quality bar
Gates from project README. If a dot golden regresses: the sizing
formula is wrong, not the golden — fix forward max 2 attempts, then stop.

## Observability / Rollback
N/A / Reversible.

## Commit
`feat(common): size all nodes from labels via shared poly_init port`
