<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — Diagnostic derisk

Investigative thread run by the executor (Opus), sequential — instrumentation
needs coherent context, so this is NOT parallel subagents. No `src/` source is
permanently modified (temp counters are reverted); the deliverable is
`findings.md`.

| ID | Description | Writes | Depends On | Done |
|---|---|---|---|---|
| D1 | Instrument the PORT mincross on 2108/b100/2471: per-pass `ncross()`, reorder & transpose pass counts, `accumCross` comparison count, `MinQuit`/`maxthispass`/`Convergence` effective values | temp edits in `src/layout/dot/mincross*.ts` (reverted), `plans/mincross-perf-derisk/findings.md` | — | [x] |
| D2 | Instrument NATIVE C `lib/dotgen/mincross.c` with the same counters via the gvplugin_dot_layout→/tmp recipe; capture the same numbers on the same inputs | throwaway C build (no repo source) | — | [x] |
| D3 | Diff C vs port; write the verdict in `findings.md`: iteration-count gap vs per-op constant factor, naming target function(s) + exact divergence; pick the AD-2 fix path | `plans/mincross-perf-derisk/findings.md` | D1, D2 | [x] |

## What to measure (both sides, same inputs)

Inputs: `2108.dot` (primary), `graphs/b100.gv` (generalization), `2471.dot`
(control — mincross is only ~12% there).

Per input, capture:
1. `ncross()` total crossings at: initial, after each `mincross_step`, final.
2. Number of `mincross` passes actually run (the `iter < maxthispass` loop) and
   the `trying`/`MinQuit` convergence trace.
3. `maxthispass`, `MaxIter`, `MinQuit`, `Convergence` effective values
   (cluster vs non-cluster path: `mincross_clust` uses `MIN(4,MaxIter)`).
4. `reorder` call count and total `reorderInner` inner-iterations.
5. `transpose` call count and total `accumCross`/`rcross` comparison count.
6. Whether the cluster path (`runRemincross` / `mincrossClust` / `interclexp`)
   runs extra passes vs C.

## Decision rule (D3)

- **If port pass-count or `ncross()` per pass ≠ C** → iteration-count gap.
  Localize the first divergence (most likely `ncross()`/crossing tiebreak or the
  convergence test) → AD-2 path 1.
- **If counts match C but per-op time dominates** → per-op constant factor →
  AD-2 path 2; profile `reorderInner`/`accumCross` internals for the lever.

## Gate (end of batch)

`findings.md` exists with C-vs-port numbers and a named fix path. All temp
instrumentation reverted (`git status src/` clean). Log the verdict + the
chosen Batch-2 path in the decision journal.
