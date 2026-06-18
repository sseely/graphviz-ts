# T1 — diagnose the transpose cost and route Batch 2

## Context

graphviz-ts is a faithful TypeScript port of C graphviz (`~/git/graphviz` is the
spec). `tests/2471.dot` has correct mincross order but does not complete: a
single `transpose()` runs >90s (V8 `--prof`: 98% in `transposeStep`). C renders
all of 2471 in 2.78s. This task DIAGNOSES the cost and routes the fix; it makes
**no source behavior change** (probes only, all reverted).

## Task

Measure, on a synthetic scalable cluster-chain (parametric N) and a bounded 2471
window, which of AD-4's causes dominates:
- **(a) pass-count** — TS `transpose` `do…while(delta>=1)` runs far more passes
  than C.
- **(b) non-convergence** — TS `delta` oscillates ≥1, never terminating.
- **(c) constant-factor** — per-pair `[0,0]` alloc, `new Array` per `rcross`,
  megamorphic `info.x ?? 0`.

Instrument both sides; compare pass-count, swaps/pass, delta trajectory, and
per-pass time. Capture C's per-rank order as the parity baseline.

## Read-set

- `src/layout/dot/mincross-cross.ts` — `transpose`, `transposeStep`,
  `transposeCounts`, `accumCross`, `rcross`, `ncross`, `exchange`
- `src/layout/dot/mincross-order.ts` — `mincrossStep` / `mincrossIter` (where
  `transpose` is called), `setMincrossTrace`
- C: `~/git/graphviz/lib/dotgen/mincross.c` — `transpose`, `transpose_step`,
  `in_cross`, `out_cross`, `ncross`, `rcross`
- Harness recipe: `README.md#harness` (C rebuild + 3-dylib copy; `node --prof`)

## Write-set

- `decision-journal.md` (the routing decision)
- Temporary probes in `mincross-cross.ts` / `mincross-order.ts` and
  `~/git/graphviz/lib/dotgen/mincross.c` — **all reverted before the task ends**.
- A scratch perf entry (e.g. `/tmp`) — not committed.

## Architecture decisions (locked)

- AD-3 measure-then-route; AD-4 the three-way fork; AD-1 parity baseline must be
  captured here for later byte-diff. Treat as locked; log conflicts, don't
  override.

## Acceptance criteria

- **Given** the synthetic mid-size graph, **when** run through both TS and
  instrumented C, **then** the journal records TS vs C pass-count, swaps/pass,
  and per-pass time with concrete numbers.
- **Given** a bounded 2471 window, **when** TS `transpose` runs, **then** the
  journal states whether `delta` is converging (trending to 0) or oscillating
  (cause b).
- **Given** the measurements, **when** T1 ends, **then** the journal names the
  dominant cause ∈ {a,b,c} and the exact Batch-2 target function(s)+line(s).
- **Given** task completion, **when** `git status` is checked, **then** the only
  tracked change is `decision-journal.md` (all probes reverted; C source clean).

## Observability

N/A — no new observable runtime operations (library-internal diagnosis).

## Rollback

Reversible — journal text only; probes reverted.

## Quality bar

Probes reverted (TS + C source clean, verify `git status` in both repos).
`npx tsc --noEmit` → 0. Do not commit scratch/probe files.

## Commit

One commit: `docs(T1): route transpose perf fix — <dominant cause>`.
