<!-- SPDX-License-Identifier: EPL-2.0 -->
# F8 — 1581 crash: dotMincross failure not propagated, dotPosition ran anyway

## Mechanism
`src/layout/dot/index.ts:168` (`dotLayoutPipeline`) called `dotMincross(g)`
and **discarded its return value**, always proceeding to `dotPosition(g)`.
C's `dotLayout` (`lib/dotgen/dotinit.c:312-315`) checks `dot_mincross`'s
return code and returns immediately on failure, **never calling
`dot_position`** (and, transitively via `doDot`/`dot_layout`, skipping
`dotneato_postprocess` too).

## Origin
`src/layout/dot/index.ts:168` (pre-fix): `dotMincross(g);` — return value
not captured.

## Causal chain
1581.dot is malformed (unbalanced braces cause `Act_23`/`Act_24` — real
members of `cluster_inner` — to also land in a stray root-scope
`{Act_23 -> Act_24; rank=same}` block). `mark_clusters` (ported faithfully,
`cluster.ts:299` area) detects the conflict and `agdelete`s them from
`cluster_inner`'s node set, emitting `"... was already in a rankset,
deleted from cluster G"` — **identical warning text in both port and C
oracle**, confirming this part is faithful.

`cluster_inner`'s GLOBAL rank window (`set_minmax`, ported in
`rank.ts:setMinmax`) was fixed **before** that deletion, at `[4, 10]` in
both port and C oracle (confirmed via an instrumented native rebuild of
`libgvplugin_dot_layout.dylib` — `set_minmax` prints identical
`localmin=0 localmax=6 leader=Act_23 leaderrank=4` → `min=4 max=10` in the
oracle). The deletion does not shrink this window (`set_minmax` only adds
the leader's global rank offset; it never recomputes from remaining
members) — this matches C exactly, not a port defect.

Root's own rank array (`allocateRanks`, `mincross-build.ts:72`) is sized
`maxrank+2` (root maxrank=8 for this graph), mirroring C's
`gv_calloc(GD_maxrank(g)+2, ...)` — a physical "+1 sentinel" slot at index
9 that exists but is logically empty (`an=0`). When `dotMincross`'s BFS
ordering pass tries to install `cluster_inner`'s rank-9 skeleton
placeholder into root's array, `placeInRankSlot`'s `an<=0` guard
(`mincross-build.ts:208`) correctly fires and returns -1 — **exactly
matching C's `install_in_rank` `agerrorf("...an = 0")` + `return -1` at
`mincross.c:1169-1172`** (confirmed via the same instrumented rebuild:
identical failure at "rank 9"). Rank 10 (`cluster_inner`'s actual max) is
never even reached in C, because C's `dot_mincross` → `dotLayout`
propagates the failure and returns immediately, **before `dot_position`
runs at all**. `clust_ht` (`position.c:682`) is therefore never called.

The port's failure propagation up through `mincrossPassSetup` →
`mincrossMain` → `runComponents` → `dotMincross` is *also* faithful (all
return -1 correctly, confirmed by tracing every `installInRank` call: only
6 calls for `cluster_inner`'s rankleaders, r=4..9, stopping exactly at the
r=9/an=0 failure — matching C's stop point). The **only** divergence was
that `dotLayoutPipeline` (`index.ts`) silently swallowed `dotMincross`'s
-1 and ran `dotPosition` anyway, which then walked `cluster_inner`'s
(correctly-computed, but now C-unreachable) `[4,10]` window against root's
`[0,9]`-sized rank array in `clustHt`
(`position-ycoords.ts:126` pre-fix), producing
`rankArr[10]` → `undefined` → `TypeError: Cannot read properties of
undefined (reading 'ht1')`.

## Ruled out
- **`ufUnion` faithfulness fix (5cc7c6b, F4)**: not implicated. Instrumented
  C oracle reproduces the identical `set_minmax`/`install_in_rank` numbers
  independent of this change; the divergence is entirely in the port's
  pipeline-level error handling, not in UF/cluster topology. F4 is the
  *trigger* (it changed which malformed-input graphs reach this rare
  install-failure state) but not the *cause*.
- **`cluster_inner`'s min/max window computation** (`setMinmax`,
  `nodeInduce`, `clusterLeader`, `collapseCluster`): byte-identical to C
  (`min=4 max=10`, confirmed via instrumented native rebuild).
- **`allocateRanks` sizing / the `an<=0` install-time guard**
  (`placeInRankSlot`, `mincross-build.ts`): both already faithful and
  already fire at the correct point (r=9), matching C's
  `install_in_rank`.
- **`mark_clusters`/rankset-conflict deletion mechanics**: identical
  warning text and identical UF/ranktype state transitions in port vs C.

## Fix
`src/layout/dot/index.ts` `dotLayoutPipeline`: capture `dotMincross`'s
return code and `return` immediately on failure (before the `maxphase===2`
check, matching C's `if (rc != 0) return rc;` ordering — C checks failure
*before* the phase-limit check). `dotPosition`/`dotPhasePost` are now
skipped exactly when C's `dot_position` would never run.

## Verification
- 1581: no longer crashes; output now 16 node groups matching the oracle's
  16 (previously 22, the pre-F4 regression baseline noted in the task);
  `flat-geom-diff` shows only 2 divergences (1 missing self-loop edge, 1
  node at 1.00pt) vs the oracle's own degenerate A4-family output — this
  matches the task's "structural shape near the pre-F4 output" bar.
- `~/git/graphviz/tests/graphs/b51.gv`: still byte-exact
  (`flat-geom-diff`: 0 elements diverge).
- `~/git/graphviz/tests/2521.dot`: unchanged from the documented post-F4
  state (1 element diverges, node `b3` at 7.00pt).
- `npm run test`: 206 files / 2606 tests, all pass.
- `npx tsc --noEmit`: clean.

## Diagnostic method note
Native C instrumentation was done via a temporary, reverted
`fprintf(stderr, ...)` patch to `~/git/graphviz/lib/dotgen/position.c` and
`rank.c`, rebuilt with `cmake --build . --target gvplugin_dot_layout` (the
`dot` binary loads this plugin from `/tmp/ghl` via `GVBINDIR`, so no
relink of the `dot` binary itself was needed). Both files were restored to
a clean `git status` before finishing (no persistent C-tree changes).
`lldb`/`gdb` breakpoint attach was tried first but failed under sandboxed
process-attach permissions; source-level `fprintf` instrumentation +
targeted rebuild was the working alternative.
