<!-- SPDX-License-Identifier: EPL-2.0 -->

# D2 — Instrument native C mincross

## Context

The faithfulness baseline. C `lib/dotgen/mincross.c` is the spec. The
convergence loop (`mincross.c:690` `mincross(g, startpass)`) runs
`for (iter=0; iter<maxthispass; iter++) { mincross_step; cur_cross=ncross();
... if (trying++ >= MinQuit) break; }` with `Convergence=.995`, static
`MinQuit`, `MaxIter`, and `maxthispass = MIN(4,MaxIter)` on the cluster path.
`ncross()` (`mincross.c:149`) sums per-rank crossings via `in_cross`/`out_cross`.

## Task

Instrument the SAME counters in C and dump them on the SAME inputs, so D3 can
diff. Use the zero-repo-mod oracle recipe (memory
`recover-slack-and-c-harness`): add `fprintf(stderr,...)` counters to a private
copy, rebuild `gvplugin_dot_layout`, copy the plugin to `/tmp/gvplugins`, and
point `dot` at it via `GVBINDIR`/config — do NOT modify the system graphviz.

1. Add counters at: each `ncross()` return, each `mincross_step` entry, the
   `mincross()` pass loop (iter, trying, maxthispass), `reorder`/`transpose`
   call sites, and the crossing-comparison inner loops.
2. Render `2108.dot`, `graphs/b100.gv`, `2471.dot` with the instrumented `dot`.
3. Record raw numbers into `findings.md` under a "C (native)" column.

## Write-set

- A throwaway instrumented copy of `lib/dotgen/mincross.c` under `/tmp` (or a
  scratch graphviz build dir) — **never** the repo, **never** system graphviz.
- `plans/mincross-perf-derisk/findings.md` — append the C column.

## Read-set

- `~/git/graphviz/lib/dotgen/mincross.c`: `mincross` (690), `mincross_step`
  (732), `ncross` (149), `mincross_clust` (531), `dot_mincross` (331),
  `MinQuit`/`Convergence` (158-159)
- memory `recover-slack-and-c-harness` (rebuild gvplugin_dot_layout→/tmp
  recipe), `oracle-native-not-wasm`

## Acceptance criteria

- **Given** 2108/b100/2471, **when** rendered with the instrumented native
  `dot`, **then** `findings.md` has a "C (native)" column with the same six
  metrics, directly comparable to D1's PORT column.
- **Given** the recipe, **when** building, **then** the system graphviz is
  untouched (the instrumented plugin is loaded from /tmp only).

## Observability / Rollback

N/A — throwaway C build; nothing in the repo changes.

## Quality bar

Counters must match the port's semantics (same definition of "a crossing
comparison", "a pass") so D3's diff is apples-to-apples. Note any definitional
mismatch explicitly in `findings.md`.
