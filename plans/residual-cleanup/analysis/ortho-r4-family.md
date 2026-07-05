<!-- SPDX-License-Identifier: EPL-2.0 -->
# R4 — 1447_1 + 2620 ortho family (diagnosed 2026-07-05) — FIX ×3 (1447_1 CONFORMANT prototyped) / 2620 SPLIT

Tie-break theory REFUTED (again — memory doubly stale). Three independent
portable-deterministic defects, each A/B-proven against instrumented C:

## M1 — gvQsort ≠ Apple libc qsort (src/util/bsd-qsort.ts)
1447_1 has an exact key tie at sorted pos 74/75 (d=39901.63999999992). Apple
qsort (apple-oss-distributions/Libc stdlib/FreeBSD/qsort.c) differs from
textbook Bentley–McIlroy: n<=7 isort threshold (port had n<7); swap_cnt==0 →
BOUNDED isort (limit 1+n/4, bail-out keeps partial mutations); introsort
depth limit 2*(fls(n)-1) → heapsort. Tied pair lands swapped → route order →
updateWts cascade. Rewrite fuzz-verified 1280/1280 byte-equal to live libc.
ruledOut: edgeLen key arithmetic; gather order (both C-faithful).

## M2 — addPEdges never ported (src/ortho/ortho-route.ts:340)
Literal comment "parallel-segment edges omitted — not needed". C ortho.c:
918-1010 resolves seg_cmp==0 (parallel segments) by walking to first chain
divergence + propagating precedence. Skipping it left parallel-track order
to top_sort default → 38/41 pairwise-swapped landing corridors. Transcribed
decide_point/propagate_prec/set_parallel_edges/removeEdge/next_seg → 38→0.
CLAUDE.md "do not skip edge-case handling" violation, found as a comment.

## M3 — gcell bb from rounded bb, not ND_coord/ND_xsize (maze.ts:256 + both adapters)
C maze.c:466-471 builds cells from coord ± max(1,xsize/2); port re-derived
centre/half-size from bb ((coord+rw)−(coord−lw) loses low bits) → 1-ULP cell
shift → one free-cell width straddles an int → per-relax-step trunc
(sgraph.c:165 int d) flips 85 vs 86 → argmin corridor flip = the maxΔ151
L-flip. Fix: OrthoNode optional coord/xsize/ysize, nodeBb uses C arithmetic.
ruledOut: updateWts (±BIG only); construction order (F1 stands); fPQ (first
divergence is the relax VALUE, not order).

## Validation (worktree prototype, preserved on branch fix/ortho-r4-family d60d4d3)
1447_1: 280 attr-diffs/maxΔ151 → CONFORMANT. 13/13 other dot-ortho corpus
files byte-unchanged (2361, 1856, 2183, 1880, 56, …). vitest 2672/2672.
gvQsort is GLOBAL (ns.ts TB_balance, dot splines, flat-labeled, pack) —
batch survey gate is the required zero-regression proof.

## 2620 — SPLIT: dot position-phase, upstream of ortho
78/237 node glyphs off (mostly ±898pt y), incl. the Δ3207 edge's head; maze
input itself differs → ortho component unmeasurable until fixed. R4 fixes
land harmlessly (5134→5116 attr diffs). Needs its own dotgen-position
diagnosis (78-node census in R4 transcript). NOT an acceptance.

## Follow-ups for R9 (fix task)
- ortho-route.ts now 569 lines, addPEdges CCN 20 / setParallelEdges 18 —
  split (e.g. ortho-parallel.ts) WITHOUT reordering C semantics.
- Port BSD heapsort.c (depth-limit path currently throws; CLAUDE.md: port
  every branch). chanSz Math.floor (maze.ts:36) unfaithful — clean up.
- Tests: 276-key qsort fixture, addPEdges channel-1258 pair, 1447_1 golden.
- 1447 (Δ192.39) byte-untouched — a FOURTH mechanism, backlog candidate.
- Memory ortho-maze-corridor-tiebreak-residual: retire on land.

Cleanup verified: ortho.c/sgraph.c reverted, plugin rebuilt, oracle
behaviorally byte-verified (1447_1+2361 SVGs identical to /tmp/ghl
baselines); dot binary and /tmp/ghl untouched; /tmp/gvmine removed.
