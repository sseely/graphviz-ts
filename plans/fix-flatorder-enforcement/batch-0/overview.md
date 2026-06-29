# Batch 0 — Instrument + pin the FLATORDER enforcement divergence

Build the C-vs-port trace of FLATORDER **enforcement** so Batch 1 consumes a pinned
first-divergence (AD-1). Diagnostic only — no layout behavior change.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T0 | Instrument C `build_ranks`/`enqueue_neighbors`/`install_in_rank` to dump the per-rank install order on b58 (specifically how node 3's children 6,8 are enqueued/installed → 6 before 8), and confirm C's FLATORDER edge weights (expect 0). Instrument the port's `buildRanks`/`enqueueNeighbors` + `flatReorder` to dump the same. Diff; pin the FIRST point where the port's enforcement of `6->8` diverges from C. | debugger | `test/diagnostic/flatorder-enforce-trace.md` | — | [x] |

**T0 outcome — hypothesis OVERTURNED, real divergence pinned.** The README's
weight-0 premise is WRONG: C's `new_virtual_edge(orig=NULL)` explicitly sets
`ED_weight(e)=1` (fastgr.c:161-166), so BOTH C and port build FLATORDER `6->8`
with weight=1 and BOTH treat it as constraining. The divergence is NOT in
build_ranks install order, weight defaults, or flat_reorder — it is in
**`left2right` (`src/layout/dot/mincross-cross.ts`)**: the flat constraint matrix
is BUILT indexed by `low` (`matrixSet(M, hLow, vLow)`, mincross-flat.ts:52-63,
mirroring C `matrix_set(M, flatindex…)` at mincross.c:1090/1097) but `left2right`
READS it with `order - vStart` (lines 90-94). C reads with `flatindex(v)=ND_low(v)`
(mincross.c:115,578). `order-vStart == low` only right after `flatBreakcycles` and
DRIFTS after any reorder. b58 pass-1 `mincrossIter`: 6.order=0 but 6.low=1 →
port reads M[0][1]=0 (miss) → no constraint → exchange swaps 6,8 → wrong `[8,6,7]`.
Fix = read by `low`. The agent's proposed `g.info.flip` swap is REJECTED: verified
both consumers (transposeStep:220, reorderFindRp:216) test only `!== 0`, and the
port's fused both-direction check makes the flip swap behaviorally inert (it only
flips the unread +1/-1 sign). **Batch-1 write-set: `mincross-cross.ts` `left2right`
index basis only + tests.**

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
