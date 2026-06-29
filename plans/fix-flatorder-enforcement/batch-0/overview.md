# Batch 0 — Instrument + pin the FLATORDER enforcement divergence

Build the C-vs-port trace of FLATORDER **enforcement** so Batch 1 consumes a pinned
first-divergence (AD-1). Diagnostic only — no layout behavior change.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T0 | Instrument C `build_ranks`/`enqueue_neighbors`/`install_in_rank` to dump the per-rank install order on b58 (specifically how node 3's children 6,8 are enqueued/installed → 6 before 8), and confirm C's FLATORDER edge weights (expect 0). Instrument the port's `buildRanks`/`enqueueNeighbors` + `flatReorder` to dump the same. Diff; pin the FIRST point where the port's enforcement of `6->8` diverges from C. | debugger | `test/diagnostic/flatorder-enforce-trace.md` | — | [ ] |

Notes:
- C instrumentation in `~/git/graphviz/lib/dotgen/mincross.c`/`fastgr.c` is
  **temporary**: gate every print by an env var (e.g. `ENFDBG`), rebuild
  `gvplugin_dot_layout`, regen `/tmp/ghl`, capture, then
  `git -C ~/git/graphviz checkout -- <files>` and rebuild clean.
- Port instrumentation is env-gated and **removed** before the batch closes — only
  the harness doc under `test/diagnostic/` is committed.
- Central question to answer: **does C order 6-before-8 via `build_ranks` install
  order (node 3's `ND_out` walk enqueues 6 then 8), and does the port's
  `build_ranks` differ — OR does the port's weight-1 `flat_reorder` actively flip
  them?** Capture BOTH the install order (post-build_ranks, pre-flat_reorder) and
  the post-flat_reorder order, in C and port, to localize the flip.
- Also confirm the `newVirtualEdge(orig=null)` field defaults divergence (C calloc-0
  vs port =1) for weight/count/xpenalty/minlen, and which of those the enforcement
  path actually reads.
- Output of T0 = the pinned divergence (which function, which value, install-order
  vs flat_reorder) that Batch 1 consumes, recorded in `flatorder-enforce-trace.md`.

Execution: this batch makes no `src/` layout change, so the 17-min survey is not
required for T0 (run tsc only). Commit = the `test/diagnostic/` doc + plan updates.
