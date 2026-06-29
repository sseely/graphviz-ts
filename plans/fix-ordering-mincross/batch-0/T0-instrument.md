# T0 — Instrument C vs port `ordering` enforcement; pin the first divergence

## Context

graphviz-ts is a faithful TS port of C Graphviz; the C source is the spec. Graphs
with `ordering=out`/`in` get the wrong in-rank node order in the port (see
`../README.md` for pinned b58 node-x). The port HAS the machinery
(`doOrderingNode`/`orderedEdges`, wired at `mincross.ts:164,274`), so the bug is
in constraint construction or its preservation through mincross passes — Batch 0
pins which.

## Task

1. **Instrument C** (`~/git/graphviz/lib/dotgen/mincross.c`), all env-gated by
   `getenv("ORDDBG")`:
   - In `do_ordering_node` (432): print the node, `outflag`, and each constraint
     edge it installs (tail→head + edge type).
   - In `ordered_edges` (504) / `do_ordering` (471): print invocation + scope
     (graph vs subgraph vs per-node).
   - After `build_ranks` and after each `mincross_step`/`transpose` pass: print
     the per-rank node order (names) so drift is visible.
   Rebuild `make -C ~/git/graphviz/build gvplugin_dot_layout`; regen
   `sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl`; capture
   `ORDDBG=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg graphs/b58.gv 2>&1 >/dev/null`.
   Then `git -C ~/git/graphviz checkout -- lib/dotgen/mincross.c` and rebuild
   clean; regen `/tmp/ghl`; verify 0 `ORDDBG` lines remain.
2. **Instrument the port** (env-gated, e.g. `process.env.ORDDBG`) at the matching
   sites in `mincross-build.ts` (`doOrderingNode`/`doOrderingAddFlatEdges`) and
   the per-rank order after build + each pass in `mincross-order.ts`/`mincross.ts`.
   Capture on b58 via `render-one.ts`. Remove the port instrumentation before the
   batch closes.
3. **Diff** the two traces; pin the FIRST divergence: the same constraint set but
   lost through passes (→ preservation, `mincross-order.ts`), or a different
   constraint set / order at construction (→ `mincross-build.ts`), or different
   invocation order (→ `mincross.ts`). Record in `ordering-trace.md` with the
   recipe and the pinned value.
4. **Fix `flat-geom-diff.mjs`**: add `<ellipse cx/cy/rx>` extraction to the node
   coordinate reader so ellipse-node graphs report real per-node deltas (it
   currently reads only `<polygon points>` → false 0.00 on ellipse nodes).

## Write-set

- `test/diagnostic/ordering-trace.md` (create) — recipe + pinned divergence.
- `test/diagnostic/flat-geom-diff.mjs` (modify) — ellipse support.

## Read-set

- `decisions.md#ad-1`, `decisions.md#key-c-references`
- `src/layout/dot/mincross-build.ts` (`doOrderingNode` ~316, `doOrderingAddFlatEdges`,
  `orderedEdges` ~348, `doOrderingForNodes` ~335)
- `src/layout/dot/mincross.ts:160-170,270-280` (orderedEdges calls)
- `~/git/graphviz/lib/dotgen/mincross.c:432-540`

## Acceptance criteria

- Given b58 rendered by instrumented C, when ORDDBG=1, then the trace shows the
  ordering constraint edges installed and the per-rank order after each pass.
- Given the port + C traces, when diffed, then `ordering-trace.md` names the first
  diverging value and the file that owns it (the Batch-1 write-set).
- Given the C source after capture, when `git status`, then `mincross.c` is clean
  and `ORDDBG=1 … b58` prints 0 ORDDBG lines.
- Given an ellipse-node graph, when `flat-geom-diff.mjs` runs, then node rows show
  the real coordinate delta (non-zero for b58's mis-ordered nodes), not 0.00.

## Observability / Rollback

N/A — diagnostic only, no runtime/observable operation. Reversible (revert commit).

## Quality bar

`npx tsc --noEmit` exit 0 (the `.mjs` is not typechecked; ensure no src change).
No 17-min survey (no `src/` layout change). C left clean. Commit: the two
diagnostic files + plan updates.

## Boundaries

- **Always**: env-gate every C/port print; revert C source after capture.
- **Never**: leave instrumentation in `src/` or in committed C; change layout
  behavior in this batch.
