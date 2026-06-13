# T5 — addXLabels in postproc.ts + EdgeLabelsDone wiring

## Context

graphviz-ts lib/label port (mission 10), batch 4. C is the spec; @see
cites; strict TS. Hook rule: ≤2 attempts per file. A PARALLEL agent is
writing src/label/xlabels.ts — import `placeLabels` and its types
against the T4 contract in batch-4/overview.md (it mirrors C
xlabels.h exactly). Do NOT read, touch, or stub src/label/* files. If
src/label/xlabels.ts does not yet exist when you finish, tsc will fail
on your import — that is expected: report it and the orchestrator runs
the combined batch gate after both halves land.

Mission 9 already ported gvPostprocess (src/common/postproc.ts):
translateDrawing maps head/tail label positions (postproc.c:121-122
equivalents). Mission 9 also landed label CREATION
(src/common/edge-label-init.ts → e.info.head_label/tail_label with
g.info.has_labels bits) and emission (src/common/emit-edge.ts, gated
on label.set). What is missing is exactly addXLabels.

## Task

1. Port into src/common/postproc.ts, mirroring postproc.c:230-590:
   centerPt, addXLabel (Flip-aware size swap), addLabelObj, addNodeObj,
   addClusterObj + countClusterLabels, getsplinepoints, edgeTailpoint /
   edgeHeadpoint (sflag/eflag arrow endpoints), edgeMidpoint, adjustBB,
   HAVE_EDGE guard, and addXLabels itself (postproc.c:405-590): the
   counting pass (n_nlbls/n_elbls/n_set_lbls/n_clbls incl. node xlabels,
   edge label/xlabel/head/tail), early-return guard (postproc.c:419-424
   incl. the EdgeLabelsDone term), object/label array construction in C
   traversal order (node order; per node: out-edges in the port's
   head-seq order — Node.outEdges already matches agfstout), the
   forcelabels attr (late_bool default true), the placeLabels call, and
   the write-back loop (set → lp.pos = centerPt, updateBB).
2. Call addXLabels(g) inside gvPostprocess at the C point
   (postproc.c:616 — after graph-label placement, before the
   graph-label space adjustment and translation).
3. AD2: add `edgeLabelsDone?: boolean` to graphInfo (src/model/
   graphInfo.ts, field only); reset where C resets (input.c:711
   equivalent — the graph-init path postproc already participates in;
   find the port's commonInitGraph/graph init and reset there if it is
   in your write-set, otherwise reset at gvPostprocess entry is NOT
   C-faithful — the correct site is dot init which you own via
   splines.ts/postproc.ts… read C input.c:705-715 and put the reset at
   the true equivalent; if that file is outside the write-set, STOP and
   report); set it at src/layout/dot/splines.ts dotSplines_ end
   (dotsplines.c:471).
4. TDD: extend src/common/postproc.test.ts — the guard cases (no
   external labels → early return; EDGE_LABEL-only + edgeLabelsDone →
   early return), addXLabel Flip size swap, edgeTail/Headpoint with and
   without arrow flags.
5. DEFAULT-PATH PROOF: render all 66 manifest goldens before/after your
   change (HEAD worktree technique: `git worktree add /tmp/m10-base
   HEAD`, render both, byte-diff, `git worktree remove /tmp/m10-base`
   — the one allowed git operation) and report the diff result. Any
   diff = gate failure.

## Write-set

src/common/postproc.ts, src/common/postproc.test.ts,
src/layout/dot/splines.ts (EdgeLabelsDone set, ~2 lines),
src/model/graphInfo.ts (one optional field), .probes/* (untracked).
Nothing else — if the C-faithful reset site lands elsewhere, STOP and
report.

## Read-set

~/git/graphviz/lib/common/postproc.c:230-616;
~/git/graphviz/lib/common/input.c:705-715 (EdgeLabelsDone reset);
~/git/graphviz/lib/dotgen/dotsplines.c:460-475 (set site);
src/common/postproc.ts; src/common/edge-label-init.ts (has_labels
bits); src/common/emit-edge.ts:90-120 (read-only); batch-4/overview.md
(T4 contract)

## Acceptance criteria

- Given a graph with no external labels, addXLabels returns at the
  guard; all 66 goldens byte-identical to the HEAD-worktree baseline
- Given EDGE_LABEL-only labels with edgeLabelsDone set, the guard
  returns (unit test)
- Given Flip, addXLabel swaps label sz dims (unit test)
- Given an edge with sflag/eflag arrows, edgeTail/Headpoint return
  sp/ep else first/last spline points (unit test)

## Quality bar

npx tsc --noEmit clean (modulo the parallel-T4 note above);
npx vitest run 0 failed at batch gate. Commit (orchestrator):
`feat(T5): port addXLabels into gv_postprocess`
