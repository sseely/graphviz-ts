# Batch 1 — curved routing (port makeStraightEdges + dispatch)

Port the curved edge generator and wire `splines=curved` into the dot routing
loop. This is the real port work; Batch 2 validates it (and compound) vs C.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Port `makeStraightEdges`(+`bend`,`get_cycle_centroid`) → `straight-edges.ts`; dispatch `EDGETYPE_CURVED`; resetRW/warn/finish wiring | sonnet | `src/layout/dot/straight-edges.ts`, `src/layout/dot/splines.ts` (and/or `edge-route-chain.ts`), `src/layout/dot/curved.test.ts` | — | [x] |

## Gate after batch
- `npm run typecheck` 0 · `npm test` (new curved unit test passes; baseline + all
  existing tests unchanged) · `npm run build` OK · C tree clean.
- **Any existing non-curved test/golden change ⇒ STOP** (ADR-4).
