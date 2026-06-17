# Batch 1 — Faithful adjacent-back routing + measure the opposing model

Two independent tasks (disjoint write-sets), run in parallel. T1 ports adjacent
back edges to faithful and lands the shared `makeFwdEdge` helper. T2 is a
measure-first study that documents the faithful recipe T3 needs — no production
code, so it cannot conflict with T1.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Faithful adjacent-back-edge routing; export `makeFwdEdge` | opus | `src/layout/dot/edge-route-chain.ts`, `src/layout/dot/edge-route.ts`, `src/layout/dot/edge-route-splines.test.ts` | — | [x] |
| T2 | Measure C's opposing/parallel model + `makefwdedge`/swapEnds recipe | opus | `plans/mission-dot-1b/decision-journal.md` | — | [x] (pre-mission spike) |

**T2 is already complete** — a pre-mission feasibility spike instrumented the C
`make_regular_edge`/`clip_and_install` and captured the recipe (see
`decision-journal.md` → "T2 spike recipe"). T3 is de-risked and viable. Batch 1
therefore reduces to **T1**.

Gate per [../README.md](../README.md). One commit per task.
- T1 commit: `feat(T1): route adjacent back edges through pathplan`
- T2 commit: `docs(T2): measure C opposing/parallel routing recipe`
