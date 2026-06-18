# Batch 3 — oracle-pin ortho-route.ts (the routing layer)

The largest unpinned stage (339 LOC): given a maze + per-edge `shortPath`
results, `convertSPtoRoute`/`assignSegs`/`assignTracks` produce the final
orthogonal route point lists. This is where most P3 golden risk lives — pinning
it is the core of the de-risk.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Oracle-pin `ortho-route.ts` route points + seg/track assignment vs native C | sonnet | `src/ortho/ortho-route.test.ts`, `src/ortho/ortho-route.ts` (only if parity fix) | T2 | [ ] |

## Dependency
T3 depends on T2 (and transitively T1): route logic consumes the maze. Both must
be green first (ADR-3 bottom-up).

## Gate after batch (full mission gate)
- `npm run typecheck` 0 · `npm test` (T3 + T2 + T1 pass; baseline unchanged) ·
  `npm run build` OK · C tree clean · diff scope `src/ortho/**` + `plans/**` only.
- **Any existing test/golden change ⇒ STOP** (ADR-4).

## Outcome feeds P3
When green, the full ortho pipeline (partition→maze→route) matches native C, so
`feature/ortho-p3-dot-splines` T3 goldens should pass on first wiring. Record the
pinned-fixture list in this mission's journal; P3 references it.
