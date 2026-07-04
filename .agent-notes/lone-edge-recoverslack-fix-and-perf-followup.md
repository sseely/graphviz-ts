<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: edge-route-order fix ships; routespline per-box perf is the follow-up

- **Context**: fix/edge-route-order mission — unified lone+group edge dispatch
  into one `edgecmp`-ordered loop (T1.2, fdad3e0).
- **Finding**: The fix is correctness-clean (0 regressions, 17 headless
  improvements, ldbxtried `n0->n1` = 7-pt corridor as C produces). But several
  large dot graphs with many multi-rank lone edges slowed ~2× due to the correct
  full-corridor routing replacing the broken degenerate straights:
  - `2475_2`: 2.45×→5.1× native
  - `share-b29`: 2.31×→3.06× native
  - `graphs-b100`: 3.84×→7.76× native
  The backstop probe confirmed it is NOT double-routing (ldbxtried: reached=70,
  routedNow=0 in the `routeDotEdges` backstop). It is the faithful cost of
  per-box corridor work now applied to lone edges that previously got cheap
  degenerate straights.
- **Root cause of the perf gap**: the port's per-box `routeSplines` call has a
  pre-existing V8 cost premium vs native C (~2–8× on large graphs). This is the
  same gap documented in `[[mincross-perf-is-perop-not-iteration]]` and
  `[[ns-hotpath-ninfo-slowmode]]`. Fixing edge order exposed it on lone-edge
  paths; it was pre-existing on group paths.
- **Impact**: Large dot graphs (b100, 2475_2, share-b29) now have higher wall-
  clock times. These were already >2× native before the fix (b100: 3.84×,
  2475_2: 2.45×, share-b29: 2.31×). No graph that was ≤2× crossed to >2×.
- **Action when this becomes a bottleneck**: profile `routeSplines` per-box loop
  with `--prof` (see `[[v8-prof-for-hangs]]`); likely targets are the `box`
  array allocation per edge segment and the `portTuple` creation in the inner
  loop. Use the same approach that reduced mincross from 83→72s (read-once
  mval, scratch reuse).
- **Confidence**: High — backstop probe rules out double-routing; perf data is
  from warm bench with BENCH_POOL=1 GVBINDIR=/tmp/ghl.
