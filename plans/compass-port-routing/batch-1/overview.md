# Batch 1 — diagnose compass-port endpoint divergence

Read-only to `src/`. T1 and T2 are **parallel** (both append to the journal —
each writes its own clearly-labeled rows; no `src/` writes, no conflict). Each
instruments native C dot and locates the single divergent port function.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Instrument C dot for `2168.dot` (regular edge + head compass ports); dump `ED_head_port.p`, the endpath box, the routed spline; dump the port's; name the divergent fn + root cause | opus | `decision-journal.md` (T1 rows) | — | [x] |
| T2 | Same for `241_0.dot` (flat same-rank compass ports): dump begin/endpath ports + flat-edge box + routed spline, port vs C; name the divergent fn + root cause | opus | `decision-journal.md` (T2 rows) | — | [x] |

## Interface (Batch 1 → Batch 2)
Each task appends a journal row:
`{ case, divergentFn (file:line), cRef (C file:line), rootCause (1 line),
  exemplarId }`.
If T1.divergentFn == T2.divergentFn, note it — Batch 2 collapses T3+T4.

## Candidate divergent functions (confirm by instrumentation, do not assume)
- `src/common/compass-port.ts` — `:sw/:ne/...` → `port.p` offset
  (C `lib/common/shapes.c:compassPort`).
- `src/common/splines-path-shared.ts` / `splines-path-end.ts` —
  begin/endpath endpoint + box (C `lib/common/splines.c` beginpath/endpath).
- `src/layout/dot/edge-route-boxes.ts`, `edge-route-faithful.ts` — regular-edge
  routing-box assembly (the #2168 path).
- `src/layout/dot/splines-flat.ts` — flat-edge begin/endpath (the #241_0 path).

## Stop conditions
Per README. Specifically AD-4: if the dump shows a deep multi-cause routing
divergence (not an isolated compass-port branch) → STOP, report, end.

## Quality gates
No `src/` change in Batch 1. Snapshot `parity.json` before Batch 2.
