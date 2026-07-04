<!-- SPDX-License-Identifier: EPL-2.0 -->

# Future: profile the *native-hanging* corpus graphs (confirm unbounded NS)

## Idea (one line)

`V8 --prof` the small graphs that hang **native graphviz itself** (not just the
port) to confirm the hang locus is the **unbounded-by-default network simplex**,
then decide a layered defense (watchdog + bounded `nslimit` at the consumer).

## Why this is distinct from `plans/dot-hangs-crashes`

That mission handled cases where the **port** exceeds the survey budget but
**native dot succeeds** (2471, 2475_2, 2108, b100 … — `dfsRange` per-op cost,
`rerank` recursion). This is the **opposite set**: inputs where **native dot
hangs too**, surfaced as `oracle-error` in `test/corpus/perf.json` /
`bench.mjs`. They are skipped from port scoring, so they have never been
root-caused.

## The graphs (found 2026-06-27, bench native phase)

Native `dot` ran >10s (effectively non-terminating) on:

| id | size | ~edges | note |
|---|--:|--:|---|
| 1652 | 240 KB | 3,051 | `NnModel` — neural-net model graph; **small yet hangs** |
| 2621 | 722 KB | 2,553 | `rankdir`; **small yet hangs** |
| 2064 | 5.2 MB | 17,246 | program call/CFG graph (`entry_global` …) |
| 1864 | 14.8 MB | 31,185 | `rankdir` |
| 2475_1 | 9.7 MB | 152,490 | `rankdir`; huge |
| 2593 | 13.9 MB | 142,476 | huge |

Real machine-generated graphs, **not fuzzer garbage**. The big three are plausibly
just super-linear runtime on huge inputs; **1652 and 2621 are the interesting
ones** — only ~2.5–3k edges yet they hang, pointing at a pathological structure,
not mere size. Profile those two first.

## Hypothesis (to confirm)

The hang is **network simplex** (rank assignment and/or x-coord), which defaults
to an **unbounded** iteration count:

- C `lib/dotgen/rank.c:449` — `int maxiter = INT_MAX;` (only clamped if the
  `nslimit` / `nslimit1` attribute is set, via `scale_clamp(nnodes, value)`).
- Port faithfully mirrors this: `src/layout/dot/rank.ts:443-445` and
  `src/layout/dot/rank-dot2.ts:484-486` — `maxiter = nslimit1 ? scaleClamp(...)
  : Number.MAX_SAFE_INTEGER`.

Mincross is already bounded in both (`mclimit` → `maxIter`), so simplex is the
prime suspect. Confidence: MEDIUM on the exact locus (not yet profiled on these
6); HIGH on the mechanism (no default ceiling on the most expensive phase).

## Steps

1. Pick `1652` (smallest pathological). Build the bundle: `npm run build:js`.
2. Profile the port with V8 (per `[[v8-prof-for-hangs]]`):
   ```bash
   node --prof <dist-harness importing dist/index.js renderSvg> 1652   # let run ~60s, ^C
   node --prof-process isolate-*.log | head -40   # top self-time fns
   ```
   Expect `leaveEdge` / `enterEdge` / `rank2Loop` / x-coord NS to dominate.
3. Confirm the lever: re-run native with a bound and see it finish —
   `dot -Tsvg -Gnslimit=2 -Gnslimit1=2 1652.dot` (also try the port with the
   same attrs). If it terminates, the unbounded-NS hypothesis holds.
4. Repeat on `2621` to check it's the same locus (or a second pathology).

> Run only when the perf bench is **idle** — profiling spawns CPU-heavy renders
> that skew any concurrent `bench.mjs` timings. (Lesson learned 2026-06-27:
> killing a bench with `pkill -f bench.mjs` orphans its in-flight native `dot`
> children, leaving ~94%-CPU loops reparented to launchd — kill the process
> group or let the bench finish.)

## If confirmed → defense options (decide then; do NOT pre-build)

Layered, cheapest → most general:

1. **Bounded `nslimit`/`nslimit1`/`mclimit` defaults at the CONSUMER**
   (plantuml-ts / browser), NOT the core port — changing the port's default
   diverges from C (CLAUDE.md: mirror C's API/defaults). Turns most hangs into
   finite, slightly-suboptimal layouts.
2. **Deadline watchdog** — the only halting-problem-proof guarantee. The test
   harness already does this (`worker.terminate` in `bench.mjs`, SIGKILL in
   `survey.ts`). Browser consumer equivalent: run `renderSvg` in a Web Worker,
   terminate on a deadline.
3. **Opt-in work-budget guard** that *throws* "layout did not converge" instead
   of spinning — a thing native graphviz does not do; a non-faithful safety
   layer kept out of the core port. Precedent: triangulation recursion →
   bounded iterative ([[triangulation-recursion-stack-overflow]]).

## Pointers

- Adjacent mission: `plans/dot-hangs-crashes/` (port-only timeouts; native OK).
- Memories: `[[v8-prof-for-hangs]]`, `[[ns-hotpath-ninfo-slowmode]]`,
  `[[triangulation-recursion-stack-overflow]]`.
