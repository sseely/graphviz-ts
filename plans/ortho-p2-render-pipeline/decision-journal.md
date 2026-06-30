# Decision Journal — ortho-p2-render-pipeline

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-18 | setup | Branched `feature/ortho-p2-render-pipeline` off `feature/ortho-p1-foundation` HEAD, NOT off `main` as the brief literally states. | P1 is not yet merged to main; it carries a faithful `src/ortho/sgraph.ts` fix (shortPath `<=0`→`<0`, sgraph.c:164) plus all P1 oracle-pin tests that P2's ADRs treat as the pinned foundation. Branching off main would discard them and reopen P1 parity. The brief's "off main" assumed P1 was merged by now. Lineage intent (main→P2→P3) preserved once P1 merges. |
| 2026-06-18 | setup | Execution plan: strictly sequential T1→T2→T3 per ADR-3 (bottom-up). Each task: instrument C (partition/maze/ortho.c) → rebuild dot plugin → gvmine dump (permute, gcells, stage state, node positions) → revert C → write TS test driven by C dumps → faithful fix if divergent → gate → commit. Single-agent (no parallelism; tasks are dependent). | ADR-3 forbids chasing a higher-stage divergence before lower stages are green. |
| 2026-06-18 | T1 | Did T1 inline (orchestrator), not via a delegated sonnet agent. | Deep C↔TS cross-referencing + C instrumentation w/ mandatory revert + faithful recursion analysis; the [[subagent-hook-loop-deaths]] / [[recover-slack-and-c-harness]] lessons warn agent PASS claims need re-verification and dirty-C-tree risk is high. Opus tier is the recommended executor for this. |
| 2026-06-18 | T1 | Oracle minted: instrumented `partition.c` (env-guarded `ORTHO_DUMP` dumps of ncells/BB/gcells, both permutes, output rects), rebuilt `gvplugin_dot_layout`, copied to `/tmp/gvmine`, ran `GVBINDIR=/tmp/gvmine dot -Tsvg` on 3 fixtures (f2pair a→b, f3chain a→b→c, f3branch a→b/a→c). C reverted; tree clean. Dumps + fixtures in `/tmp/ortho-p2/`. | ADR-1/ADR-2. Permute is a pure fn of nsegs+seed (f3chain & f3branch both nsegs=16 → identical permutes). |
| 2026-06-18 | T1 | **Faithful fix #1 (RNG):** `partition.ts` used MT19937 (`util/mt19937`); C uses POSIX `drand48`/`srand48(173)` (partition.c:195,737). Replaced with `common/random.ts` (existing exact drand48 port used by neato/fdp). Verified TS-generated permute == C-dumped permute for nsegs=12 and 16, exactly. | C is spec; MT19937 can never reproduce drand48 ordering. DRY: reused existing faithful PRNG. |
| 2026-06-18 | T1 | **Faithful fix #2 (perp):** TS `perp` was `{x:p.y,y:p.x}`; C `perp` (geomprocs.h:140) is `{x:-p.y,y:p.x}` — negates x. Missing negation put the vertical-pass decomposition in a negated-y frame so it barely intersected the horizontal pass (6 rects vs 13). Restored the negation. | C double-negates (perp then `-seg.v0.x` in trap_to_box); the two cancel to a positive frame. |
| 2026-06-18 | T1 | **Faithful fix #3 (reachability):** TS `collectBoxes` emitted a box for *every* valid rectangular trapezoid, including obstacle interiors; C `monotonate_trapezoids` emits only for trapezoids reachable from the inside-polygon start via u0/u1/d0/d1, excluding obstacle interiors (extra set == gcell bbs exactly). Replaced with faithful `monotonateTrapezoids` (inside_polygon start + flood-fill). Proved the C monotone-chain machinery is dead for box output and every traverse_polygon branch recurses into all valid neighbours, so visited SET = connected component; iterative flood-fill is set-faithful. | ADR-5. Dropped only provably-dead chain bookkeeping; preserved inside_polygon + u/d adjacency semantics. |
| 2026-06-18 | T1 | **ORDER RISK flagged for T2:** `monotonateTrapezoids` emits in iterative-flood-fill order, NOT C's recursive-DFS order, so the final rect *order* is not bit-identical to C (T1 accepts order-normalized — set matches exactly, all 3 fixtures). mkMaze builds `cells[i].bb = rects[i]` in order, so if T2 maze/sgraph node numbering proves order-sensitive, come back and port traverse_polygon's exact DFS branch/emission order into partition (lowest-stage fix, ADR-3). | T1 acceptance permits order-normalized; do not speculatively port the 200-line DFS until T2 demonstrates the need (YAGNI). |
| 2026-06-18 | T1 | **DONE.** `partition.test.ts` (10 tests: SEED, per-fixture permute + rect-set + determinism) all green. Gates: typecheck 0 · full suite 1905 passed (1895 baseline unchanged + 10 new; no neato-ortho regression, ADR-4 ok) · build OK · C tree clean. | — |
| 2026-06-18 | T2 | Oracle minted: instrumented `maze.c:mkMazeGraph` (env-guarded dump after gsave of ncells/ngcells/nnodes/nedges, per-snode isVert + both linked-cell bbs, per-sedge v1/v2/weight) for the 3 T1 fixtures. C reverted; tree clean. Dumps in `/tmp/ortho-p2/*.maze.dump`. | ADR-1. Reused T1 fixtures (ADR-3). |
| 2026-06-18 | T2 | Drove TS from C gcell bbs directly (no separate node-position dump): `nodeBb` is idempotent for these gcells (w=54,h=36 ≥ 2), so `mkMaze` reproduces the same gcells/BB. | ADR-2; avoids a redundant dump. |
| 2026-06-18 | T2 | Compared the maze graph **order-normalized** (T2 acceptance): snode keyed by (isVert, cells[0].bb, cells[1].bb) — unique per boundary; sedge keyed by sorted endpoint node-keys + weight. Index spaces differ from C (T1 ORDER RISK) but the maze graph is geometry-determined. | The graph is structurally identical; only node/edge indices are renumbered. |
| 2026-06-18 | T2 | **Result: maze.ts is byte-faithful as-is — NO source fix needed.** All sets match C exactly: ncells/ngcells/nnodes/nedges (13/2/22/34, 18/3/32/52, 24/3/46/88), full snode set, full sedge set (incl weights 36/54/536/545…), determinism. The T1 partition fix was the only thing the maze needed. | Confirms ADR-3 bottom-up: the maze divergence (had there been one) was a partition bug, now fixed. |
| 2026-06-18 | T2 | **DONE.** `maze.test.ts` (15 tests). Gates: typecheck 0 · full suite 1920 passed (1905 unchanged + 15 new; ADR-4 ok) · build OK · C tree clean. ORDER RISK still un-triggered (maze passed order-normalized); carry it into T3 where routing tie-breaks could surface it. | — |
| 2026-06-18 | T3 | Oracle minted: instrumented `ortho.c:attachOrthoEdges` (env-guarded per-edge dump of ND_coord/ports/p1/q1, each route segment isVert/comm_coord/p1/p2/track_no/vtrack-htrack, and the full installed `ispline`). C reverted; tree clean. Dumps in `/tmp/ortho-p2/*.route.dump`. | ADR-1. Found ports = 0 for these edges → p1 = ND_coord = node centre. |
| 2026-06-18 | T3 | **WRITE-SET EXPANSION (user-authorized, faithfulness mandate):** beyond `ortho-route.ts`/test, also edited `index.ts` (buildSpline — port of attachOrthoEdges emission) and `sgraph.ts` (P1 file; createSEdge/reset), and updated existing `ortho.test.ts` AC3. User explicitly: "the C code is the spec … matching exactly … Not matching costs us"; authorized index.ts; approved the AC3 update via AskUserQuestion. | A partial/scope-limited comparison would have masked real divergences; faithfulness is the overriding constraint. |
| 2026-06-18 | T3 | **Faithful fix #1 (buildSpline endpoints, index.ts):** TS used `e.tail.bb.LL` for p1/q1; C uses `ND_coord(tail)+ED_tail_port` (ortho.c:1075). Ports are 0 for plain ortho edges and the TS OrthoNode models no ports, so the faithful value is the node CENTRE. Fixed → route endpoints now match C (e.g. f2pair (0,90)→(0,18)). | C is spec; bb.LL (corner) was a non-faithful shortcut. |
| 2026-06-18 | T3 | **Faithful fix #2 (sgraph createSEdge/reset — ROOT CAUSE, sgraph.ts):** `createSEdge` used `adjEdgeList.push(idx)` (append); C `addEdgeToNode` (sgraph.c:45) writes at index `n_adj` then increments. After `reset()` restores nAdj=saveNAdj, C OVERWRITES the stale temp-edge slot, but TS's push left the new edge BEYOND nAdj — so `relaxNeighbors` (reads `adjEdgeList[0..nAdj)`) followed the STALE previous-edge index. Broke the 2nd+ edge sharing a boundary node: f3chain b→c (routed after a→b) zig-zagged via a→b's edge (4 segs vs C's 1). Confirmed order-dependent (b→c correct in isolation). Fixed createSEdge to index-assign like C; simplified `reset` to match sgraph.c exactly (dropped the push-era adjEdgeList truncation hack). | True root cause of T3 divergence. P1's tests never exercised consecutive shared-node edges, so the push bug survived. |
| 2026-06-18 | T3 | **Existing-test update (ortho.test.ts AC3, user-approved):** AC3 asserted no UNCLIPPED route point lands inside a node bbox — but C's unclipped endpoints sit at node centres (clip_and_install, the caller's job, clips them; not modelled here). Fix #1 exposed this. Rewrote AC3 to assert endpoints == node centres (faithful) + interior bends clear of nodes. ADR-4 STOP raised to user; user chose "Update AC3 to match C". | AC3 encoded the old bb.LL behaviour, not C's. |
| 2026-06-18 | T3 | **DONE.** `ortho-route.test.ts` (6 tests: exact route point lists + determinism, all 3 fixtures). Every edge's installed point list matches C EXACTLY (incl. f3branch track split a→b x=-18 / a→c x=+18). Gates: typecheck 0 · full suite 1926 passed (1920 + 6 new; AC3 updated in place, no other baseline change) · build OK · C tree clean. ORDER RISK never materialized — routes matched exactly once the createSEdge root cause was fixed. | segCmp/track assignment validated conformant; the hot spot was sound, the bug was in edge-list bookkeeping. |

## Mission summary (2026-06-18)

**Status: COMPLETE.** All 3 batches green; the full ortho render pipeline
(partition → maze → route) is oracle-pinned conformant to native
instrumented `dot` for 3 `splines=ortho` fixtures (f2pair a→b, f3chain
a→b→c, f3branch a→b/a→c).

**Tasks completed: 3/3** (T1 partition, T2 maze, T3 route).

**Faithful parity fixes (4 — all cite C, all confined to ortho):**
1. `partition.ts` RNG — MT19937 → POSIX `drand48`/`srand48` (partition.c:195,737).
2. `partition.ts` `perp` — restored x negation (geomprocs.h:140).
3. `partition.ts` `collectBoxes` → `monotonateTrapezoids` reachability
   (monotonate_trapezoids; excludes obstacle interiors).
4. `index.ts` buildSpline endpoints → node centre (ortho.c:1075); **`sgraph.ts`
   createSEdge index-assign + reset** (sgraph.c:45 — root cause of multi-edge
   route corruption).

**Decisions flagged for review:**
- Branched off the unmerged P1 branch, not `main` (P1 carries the pinned
  foundation). Merge P1→main, then this branch's base resolves cleanly.
- Write-set expanded beyond the brief (index.ts, sgraph.ts, ortho.test.ts AC3)
  under the user's explicit faithfulness mandate + AskUserQuestion approval.
- T1 partition emits rects in flood-fill order, not C's exact DFS order
  (`monotonate` chain machinery proven dead for box output). T1/T2 compared
  order-normalized; T3 routes matched EXACTLY anyway, so the order divergence
  is cosmetic for the pipeline — but if a future consumer needs C's exact
  cell/rect order, port traverse_polygon's DFS emission order into partition.

**Quality gates (final, full branch):** typecheck 0 · `npm test` 1926 passed
(1895 P1 baseline + 31 new: 10 partition, 15 maze, 6 route; AC3 updated in
place) · build OK · C tree clean (`git -C ~/git/graphviz status lib/` empty) ·
diff scope `src/ortho/**` + `plans/ortho-p2-render-pipeline/**` only.

**Known issues / follow-ups:** none blocking. Pinned-fixture list for P3:
f2pair, f3chain, f3branch (gcells/permute/maze/route dumps in `/tmp/ortho-p2/`).
P3 (`feature/ortho-p3-dot-splines`) wiring goldens should now pass on first try.

**Commits:** `3020a03` (T1), `9751159` (T2), `7bbfd09` (T3).
