# Decision journal

| When | Task | Decision / observation | Rationale |
|------|------|------------------------|-----------|
| 2026-06-29 | setup | Created branch `feature/fix-ordering-mincross` off main | Mission convention (merge-commit branch) |
| 2026-06-29 | B0 plan | Batch 0 = single task T0 (debugger agent): instrument C `do_ordering_node`/`ordered_edges` + per-pass order vs port equivalents on b58 (+ordering_dot1), pin first divergence; fix `flat-geom-diff.mjs` ellipse blind spot. No `src/` change → tsc-only gate. | AD-1, batch-0/overview. Pre-read: C construction sorts by AGSEQ (edgeidcmpf, mincross.c:1691); port sorts by `seq` (mincross-build.ts:331) — structurally aligned, so suspect is iteration order or preservation through passes, to be pinned by T0. |
| 2026-06-29 | T0 done | **Pinned (Suspect A, construction): `mincross-build.ts:331`.** C `new_virtual_edge` does `AGSEQ(virtual)=AGSEQ(orig)` (fastgr.c:143) — verified in C source. Port `copyVirtualEdgeInfo` (fastgr.ts:144) copies count/weight/ports/`to_orig` but NOT seq; `newVirtualEdge` auto-assigns fresh `_nextSeq++`. So the ordering sort `(a,b)=>a.seq-b.seq` sorts by virtual-creation order not DOT-declaration order. b58 node 7: C sorts [7->5(seq3),7->4(seq4)]→FLATORDER 5->4; port sorts [7->4(seq13),7->5(seq14)]→findFlatEdge(4,5) early-exits on existing same-rank flat edge→NO FLATORDER→4 left of 5 (wrong). | Independently confirmed vs C `new_virtual_edge`. flat-geom-diff.mjs ellipse fix verified (b58 now reports node2/node4 Δ=144). Both git trees clean, tsc 0. |
| 2026-06-29 | T0 fix choice | **Use the localized sort-key fix** at mincross-build.ts:331 (`(a.info.to_orig?.seq ?? a.seq)`), NOT copying seq globally in `copyVirtualEdgeInfo`. | Global seq-copy would match C exactly but changes EVERY virtual edge's seq (huge blast radius vs 492 conformant) and is outside the T0-pinned write-set (stop cond #3). Localized fix runs only in `doOrderingNode` (only under `ordering=`), reproduces C's observable order, AD-2 minimal blast radius. AD-3 survey will gate regressions. |
| 2026-06-29 | B0 gate | tsc --noEmit exit 0; write-set = test/diagnostic/{flat-geom-diff.mjs,ordering-trace.md} + plan docs (excl. pre-existing .claude/settings.autonomous.json). No `src/` change → 17-min survey not required for B0. Committing T0. | autonomous protocol step 7 |
| 2026-06-29 | T1 start | First applied the localized sort-site workaround at mincross-build.ts:331 (`(a.info.to_orig?.seq ?? a.seq)`). b58: nodes 1,2,4,5,7 became EXACT vs C (incl. headline node 7 = 5 left of 4); `graphs/in` fully cleared (0 divergence). Residual on b58 = nodes 3,6,8 only. | render-one + flat-geom-diff (ellipse-fixed) |
| 2026-06-29 | T1 **approach change (user-directed)** | User flagged the workaround is NOT a faithful C mimic. **Switched to the faithful root-cause fix**: C `new_virtual_edge` does `AGSEQ(e)=AGSEQ(orig)`; port `copyVirtualEdgeInfo` now sets `e.seq = orig.seq` (fastgr.ts), `Edge.seq` made mutable (model/edge.ts), and the sort reverted to the original `a.seq - b.seq`. This corrects the seq unfaithfulness EVERYWHERE virtual-edge AGSEQ is used, not just the ordering site. | CLAUDE.md "C is sacred" prime directive; AskUserQuestion → "Faithful seq-copy". |
| 2026-06-29 | T1 write-set deviation | **Deviation from AD-2's pinned write-set** (T0 pinned mincross-build.ts as the SYMPTOM; the true divergence is fastgr.ts `new_virtual_edge`). Write-set is now: `src/model/edge.ts` (seq mutable), `src/layout/dot/fastgr.ts` (seq-copy), `src/layout/dot/mincross-build.ts` (comment only, sort reverted to faithful), `src/layout/dot/ordering.test.ts` (new). One logical unit / one commit. | AD-2 explicitly did NOT pre-commit the write-set; user-approved faithful fix lands at the real root cause. Faithful fix gives IDENTICAL b58 output to the workaround. All 2474 unit tests pass; new ordering.test.ts (4) green. Full survey gate running to validate no conformant regression (AD-3). |
| 2026-06-29 | T1 **survey GATE PASS** | Probe vs committed baseline: **regressions=0, clip-regressions=0, GATE PASS**. conformant 492→493; **`graphs-in`: structural-match → conformant** (the only status change; per-graph diff confirms 0 regressed). Negative check: reverting the seq-copy fails the 3 discriminating ordering.test.ts tests → real regression guards. Committed `bcecf61`. | AD-3 satisfied. Survey wrote test/corpus/parity-probe.json (the "wrote parity.json" log string is hardcoded, line 416); committed parity.json untouched. |
| 2026-06-29 | b58 3/6/8 residual = **deeper flat-enforcement cause (AD-5, NOT chased)** | b58 nodes 1,2,4,5,7 EXACT; residual 3/6/8 (6-before-8 from node 3's ordering=out). FLATORDER 6→8 IS built correctly now (verified via PORTDBG). **Experiment**: set FLATORDER weight=0 to match C `new_virtual_edge(NULL)` (calloc-0) → b58 WORSE (8→12 diverged; broke node-7 5/4). Proves the port enforces FLATORDER via **weight-1 flat_reorder/flat_search**, whereas C uses **weight-0 FLATORDER + build_ranks BFS install order** (constraining_flat_edge & flat_search both `continue` on weight==0; mincross.c:1093, constraining_flat_edge). Reconciling = reworking the port's flat-enforcement model = SEPARATE mission. Experiment reverted; src == bcecf61. | Stop-condition #5 (deeper than scoped). AD-5: document residual, do not chase. Same secondary cause covers ordering_dot1×3, pgram×3, trapeziumlr×3, 1472 (all still diverged, 0 regression). |

## Mission summary (2026-06-29)

- **Tasks completed:** T0, T1, T2 (all 3 batches).
- **Root cause (pinned, T0):** port virtual edges did not inherit `AGSEQ(orig)`
  (C `new_virtual_edge` does `AGSEQ(e)=AGSEQ(orig)`), so `do_ordering_node`'s
  AGSEQ-keyed sort ordered by virtual-creation order, mis-building the FLATORDER
  ordering constraint.
- **Fix (T1, faithful, user-approved):** `copyVirtualEdgeInfo` sets
  `e.seq = orig.seq` (fastgr.ts); `Edge.seq` made mutable (model/edge.ts); sort
  reverted to faithful `a.seq - b.seq` (mincross-build.ts). New `ordering.test.ts`
  (4 tests; 3 discriminate the bug). Commit `bcecf61`.
- **Result:** Survey GATE PASS, **0 regressions / 0 clip-regressions**. `graphs-in`
  structural-match → conformant (conformant 492→493). All 2474 prior unit tests pass.
- **Decisions flagged for review:** write-set deviated from T0's pinned symptom file
  (mincross-build.ts) to the true root cause (fastgr.ts + model/edge.ts) — approved
  by the user mid-mission (faithful-vs-workaround AskUserQuestion).
- **Known issue / follow-up:** b58 (nodes 3/6/8) and `ordering_dot1`×3, `pgram`×3,
  `trapeziumlr`×3, `1472` remain diverged on a SEPARATE flat-enforcement cause —
  C uses weight-0 FLATORDER + `build_ranks` install order; the port uses weight-1
  `flat_reorder`. Reconciling is a separate mission (see batch-2/overview.md). These
  stay in the tracked-gap backlog (not accepted deltas).
- **Quality gates:** `tsc --noEmit` 0; `vitest run` 2478 pass / 1 skip; survey
  rules-gate GATE PASS; git diff name-only within declared (deviated) write-set.
