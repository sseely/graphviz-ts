# T2 — Edge-label positioning for splines=ortho (C-faithful warn+downgrade)

## Context
Faithful TS port (root `CLAUDE.md`). Completes the dot ortho dispatch for the
edge-label sub-case of `dotsplines.c:253-257`. **Critical fact:** native C does
NOT route edges around labels — `orthoEdges` (`ortho.c:1196-1199`) warns
*"Orthogonal edges do not currently handle edge labels. Try using xlabels"* and
forces `useLbls=false`. So "label support" = **position** labels (so they
render at sensible spots) + dispatch `orthoEdges(g,true)`; edges may cross
labels, identical to native `dot`. Builds on T1. Tests: **vitest**; TS strict.

## Task
Mirror `dotsplines.c:253-257`: inside the T1 ortho branch, when the graph has
edge labels (`GD_has_labels & EDGE_LABEL` → the TS equivalent on
`g.info`/root), **before** calling `orthoEdges`:
1. Position edge labels via `setEdgeLabelPos(g)` — reuse existing
   `placeRegularEdgeLabels`/`placeVnlabel` (`src/layout/dot/splines-label.ts`).
   If those omit the `ND_alg` non-adjacent-flat-edge label case
   (`dotsplines.c:205-210`: `l.pos = ND_coord(n); l.set = true`), add a thin
   `setEdgeLabelPos` wrapper in `splines-label.ts` covering it + `updateBB`.
2. Call `orthoEdges(buildOrthoGraph(g), true, installCb)`. `orthoEdges` already
   emits the warning and downgrades `useLbls=false` (`src/ortho/index.ts:101-107`)
   — keep that; **do not add label routing**.
3. No-label case stays exactly as T1.

## Write-set
- `src/layout/dot/splines.ts` (modify — pass `useLbls` from has-labels test)
- `src/layout/dot/splines-label.ts` (modify — only if a `setEdgeLabelPos`
  wrapper for the `ND_alg` case is needed)
- `src/layout/dot/ortho-labels.test.ts` (create)

## Read-set
- `~/git/graphviz/lib/dotgen/dotsplines.c:251-259` (label dispatch), `:199-218`
  (`setEdgeLabelPos`)
- `~/git/graphviz/lib/ortho/ortho.c:1156-1200` (`orthoEdges` label handling)
- `src/layout/dot/splines-label.ts:58-120, 314+` (`placeVnlabel`,
  `placeRegularEdgeLabels`)
- `src/ortho/index.ts:96-108` (`orthoEdges` warn/downgrade)
- `decisions.md#adr-2`; T1's branch in `splines.ts`

## Architecture decisions (locked)
ADR-2 (position labels, do NOT route around them — C parity), ADR-4, ADR-5.
**If correctness appears to need routing edges around labels, STOP** — C lacks
it; inventing it violates the faithful-port mandate.

## Interface contract
```ts
// splines-label.ts (only if added):
export function setEdgeLabelPos(g: Graph): void; // place regular + ND_alg flat labels; updateBB
// splines.ts ortho branch now passes useLbls = hasEdgeLabels(g).
```

## Acceptance criteria
- Given `splines=ortho` + an edge with a `label`, when `dotSplines_`, then the
  label's position is set (`label.set === true`, `label.pos` ≈ its virtual-node
  coord) and a warning is emitted; `e.info.spl` is orthogonal.
- Given the same, then **no edge is rerouted around the label** (edge geometry
  equals the no-label ortho route for that topology — C parity).
- Given `splines=ortho` **without** labels, when `dotSplines_`, then behavior is
  exactly T1's (no warning, no label placement).

## Observability requirements
N/A — pure layout. (The label warning is existing C behavior, not new
instrumentation.)

## Rollback notes
**Reversible** (ADR-4). Revert the has-labels branch; no migration.

## Quality bar
`npm run typecheck` 0 · `npm test` (T2 + T1 pass; baseline unchanged) ·
`npm run build` OK · C tree clean. Mind the CCN-10 / 30-line caps on the ortho
branch — extract a helper if needed. Return only the structured result.

## Commit
One commit: `feat(T2): position edge labels for splines=ortho (C warn+downgrade)`.

## Boundaries
- **Never:** route edges around labels (not in C); change non-ortho label
  placement; edit outside the write-set.
- **Ask first (STOP):** the has-labels detection needs a graph field the type
  lacks; `placeRegularEdgeLabels` reuse would alter non-ortho output.
