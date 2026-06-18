# Batch 1 — dot ortho dispatch + adapter (no labels)

Wire `splines=ortho` into the dot engine for the no-edge-label case. This is the
foundational task; T2 (labels) and T3 (goldens) build on it.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Dot ortho dispatch branch + dot-local adapter + `resetRW` | sonnet | `src/layout/dot/splines.ts`, `src/layout/dot/ortho-adapter.ts`, `src/layout/dot/ortho-dispatch.test.ts` | — | [ ] |

## Gate after batch
- `npm run typecheck` 0 · `npm test` (new T1 unit test passes; baseline + all
  existing tests unchanged) · `npm run build` OK · C tree clean.
- **Any existing non-ortho test/golden change ⇒ STOP** (ADR-4).
