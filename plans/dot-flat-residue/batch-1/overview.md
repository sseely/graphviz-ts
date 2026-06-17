# Batch 1 — flat-edge residue

Two faithful ports of dot flat-edge routing branches. Sequential, one
executor, one commit each. Files are nearly disjoint (T1 in
`splines-flat-labeled.ts` + `edge-route.ts`; T2 in `splines-flat.ts` +
`splines-label.ts`), so there is no write conflict, but T2's feasibility
spike benefits from T1's oracle-pin harness being in place.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Port `makeSimpleFlat`; route no-label adjacent flat groups | inline (orchestrator) | `splines-flat-labeled.ts`, `edge-route.ts`, `splines-flat-labeled.test.ts` | — | [ ] |
| T2 | Copy flat-edge label pos back from aux graph | inline (orchestrator) | `splines-flat.ts`, `splines-label.ts`, `splines-flat.test.ts` | — | [ ] |

Both are small, faithful ports with deep existing context in this
session — executed inline, not delegated. Each is committed and gated
independently.

## C spec anchors

- `makeSimpleFlat` — `~/git/graphviz/lib/dotgen/dotsplines.c:1075`
- no-port dispatch — `dotsplines.c:1156-1166`
- label copy-back — `dotsplines.c:1273-1277`
