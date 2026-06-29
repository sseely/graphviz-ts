# Batch 0 — Instrument + isolate both residuals

Build the C-vs-port flat-geometry trace that drives Batches 1–2, so each fix
consumes a pinned first-divergence (AD-1). Diagnostic only — no behavior change.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T0 | Instrument `makeSimpleFlatLabels` (rep-edge ctrl pts + arc boxes) and `flatNode`/rank `ht1/ht2`, C + port, env-gated; diff on 2368; pin each first-divergence | debugger | `test/diagnostic/flat-geom-trace.md`, `test/diagnostic/flat-geom-diff.mjs` | — | [ ] |

Notes:
- C instrumentation in `~/git/graphviz/lib/dotgen/{dotsplines.c,flat.c,position.c}`
  is **temporary**: gate every print by an env var (e.g. `FGEOM`), rebuild
  `gvplugin_dot_layout`, regen `/tmp/ghl`, capture, then
  `git -C ~/git/graphviz checkout -- <files>` and rebuild clean.
- Port instrumentation is env-gated and **removed** before the batch closes —
  only the harness docs under `test/diagnostic/` are committed.
- Output of T0 = two pinned divergences (Issue 2 geometry, Issue 1 vspace) that
  Batches 1 and 2 consume.
