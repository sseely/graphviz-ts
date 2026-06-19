# Batch 2 — edge-label positioning for ortho (faithful warn+downgrade)

Extend the T1 ortho branch to the edge-label sub-case of
`dotsplines.c:253-257`: position labels, then dispatch `orthoEdges(g, true)`
(which, per C, warns and downgrades — edges are **not** routed around labels).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Edge-label positioning + `orthoEdges(g,true)` dispatch | sonnet | `src/layout/dot/splines.ts`, `src/layout/dot/splines-label.ts` (only if a `setEdgeLabelPos` wrapper is needed), `src/layout/dot/ortho-labels.test.ts` | T1 | [ ] |

## Dependency / file ownership
- T2 writes `src/layout/dot/splines.ts` (same file as T1) → **must run after T1**
  (sequential, not parallel).

## Gate after batch
- `npm run typecheck` 0 · `npm test` (new T2 test + T1 test pass; baseline
  unchanged) · `npm run build` OK · C tree clean.
- **Any existing non-ortho test/golden change ⇒ STOP** (ADR-4).
