# Batch 1 — Align the x-NS absolute anchor

Iteratively eliminate the pivot-order divergences the Batch-0 trace reveals, in
pivot order. Fix ONLY the first remaining divergence each step, then re-trace and
run the full survey. **Final coords must not move (AD-3): the survey stays green
and 2368 stays diverged throughout; progress is the internal-coord trace
converging to C (AD-2).** The executor runs only the candidates the trace flags
(likely a subset of T1–T5).

> **RE-SCOPED by the Batch-0 finding.** The port's x-NS is already bit-exact
> with C (T0 trace, byte-identical internal frame). T1–T5 (NS-pivot alignment)
> are **no-ops** — there is no divergence to align. Batch 1 is the single change
> below: remove the port-only `normalizeXcoords`. See `../decision-journal.md`.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| B1 | Remove port-only `normalizeXcoords` call + dead `minNormalLeftX`/`shiftAllXcoords` (C has no normalize for balance=2; raw x-NS frame already == C). Gate: `XNS_NONORM` survey GATE PASS, 0 regr. | orchestrator | `src/layout/dot/position.ts` | T0 | [x] |
| T1 | ~~Align `GD_nlist` order for the x-aux graph~~ — NO-OP (trace already matches) | — | — | T0 | [x] |
| T2 | ~~Align in/out edge-list + aux-edge insertion order~~ — NO-OP | — | — | T1 | [x] |
| T3 | ~~Align `leaveEdge` selection~~ — NO-OP | — | — | T2 | [x] |
| T4 | ~~Align `enterEdge` + `update`/`rerank`~~ — NO-OP | — | — | T3 | [x] |
| T5 | ~~Align `lrBalance`~~ — NO-OP | — | — | T4 | [x] |

Execution rule: after the trace shows a divergence at one of these sites, fix
that site, re-run the Batch-0 trace + `xns-diff.mjs`, and run the survey gate.
A site whose trace already matches C is skipped (mark `[x]` "no change needed").
Batch done = port internal x-coords for 2368_1 (and a spot-check on 2368)
match C exactly AND survey shows 0 regressions.

Per-task acceptance criteria live in each `TN-*.md`. They share:
- Given the fix, when the Batch-0 trace is re-run, then the previously-first
  divergence is gone (the trace advances).
- Given the fix, when the full survey runs, then 0 regressions (no final coord
  moved) — else STOP (AD-3).
