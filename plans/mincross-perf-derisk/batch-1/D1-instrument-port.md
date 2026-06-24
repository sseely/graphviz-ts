<!-- SPDX-License-Identifier: EPL-2.0 -->

# D1 — Instrument the port's mincross

## Context

`graphviz-ts` is a faithful pure-TS port of Graphviz; `~/git/graphviz` is the
spec. 2108 is mincross-bound (`reorderInner` 47%, `accumCross` 17%). The port's
mincross lives in `src/layout/dot/mincross.ts` (driver: `mincrossMain`,
`mincrossIter`, `mincrossStep`, `reorder`, `transpose`, `runRemincross`,
`mincrossClust`), `mincross-order.ts` (`reorderInner`, `medians`),
`mincross-cross.ts` (`accumCross`, `transposeStep`, `rcross`, `ncross`-equiv).

## Task

Add **temporary** counters (reverted at end of batch — see AD-1/AD-3) to the
port and dump, per input, the metrics in `batch-1/overview.md#what-to-measure`.

1. Build a dist harness that renders one file and prints the counters
   (`globalThis`-attached counters incremented in the hot functions, mirror the
   `ns-hotpath` count recipe from the prior mission).
2. Run on `2108.dot`, `graphs/b100.gv`, `2471.dot`.
3. Record raw numbers into `findings.md` under a "PORT" column.

Counters to add (temporary):
- per-pass `ncross()` value (the port's total-crossings function) — print the
  sequence across passes.
- `mincross` pass count + the `trying`/MinQuit convergence trace.
- `reorder` calls, `reorderInner` inner-iteration total.
- `transpose` calls, `accumCross` comparison total, `rcross` work total.

## Write-set

- `src/layout/dot/mincross*.ts` — **temporary** counter edits, reverted before
  the batch gate (`git checkout` / restore from backup).
- `plans/mincross-perf-derisk/findings.md` — create; the PORT numbers.
- Scratch harness under the session scratchpad (not committed).

## Read-set

- `src/layout/dot/mincross.ts` (driver loop), `mincross-order.ts:reorderInner`,
  `mincross-cross.ts:accumCross/transposeStep/rcross`
- `batch-1/overview.md#what-to-measure`
- memory `v8-prof-for-hangs`, `ns-hotpath-ninfo-slowmode` (counter recipe)

## Acceptance criteria

- **Given** 2108/b100/2471, **when** rendered with counters, **then**
  `findings.md` has a PORT column with all six metrics per input.
- **Given** the batch gate, **when** D1 finishes, **then** `git status
  src/` is clean (all temp instrumentation reverted).

## Observability / Rollback

N/A — temporary instrumentation only; reverted. No output change.

## Quality bar

Counters must not alter render output while measuring control flow (increment
only; never change a branch). Revert cleanly.
