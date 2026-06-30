# T3 — root graph label: doGraphLabel call + place_root_label

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Suite
baseline 1217/0, 67 goldens. Hook rule: smallest fix, ≤2 attempts per
file, then move on.

doGraphLabel (src/layout/dot/graph-label.ts) already ports
input.c:do_graph_label — it reads the `label` attr, builds
sg.info.label via makeLabel, sets GRAPH_LABEL. Today the dot pipeline
calls it only for clusters (rank.ts:213 buildSkeleton); the ROOT call
(input.c:719, end of graph_init) is missing, and so is
place_root_label (postproc.c:174-205, called at postproc.c:676).

## Task

1. Call `doGraphLabel(g, measurer)` for the root graph in dotGraphInit
   (src/layout/dot/init.ts) at the input.c:719-equivalent position
   (decisions.md D1). Check doGraphLabel's measurer parameter — find
   how dotGraphInit can reach the measurer (dotInitNodeEdge gets one;
   match the existing plumbing, read init.ts first). If plumbing the
   measurer requires touching files outside the write-set, STOP and
   report.
2. Port place_root_label (postproc.c:174-205) into
   src/common/postproc.ts and call it from gvPostprocess at the
   postproc.c:676-equivalent point — read postproc.c:600-680 and
   preserve statement order relative to addXLabels (616) and
   translation (locked constraint in decisions.md).
3. TDD: extend src/common/postproc.test.ts — graph label positioned
   per labelpos/labeljust cases in place_root_label; absent label →
   no-op.

## Write-set

src/layout/dot/init.ts, src/common/postproc.ts,
src/common/postproc.test.ts. Nothing else.

## Read-set

~/git/graphviz/lib/common/input.c:705-725 (call site), 838-900
(do_graph_label, for cross-checking the existing port);
~/git/graphviz/lib/common/postproc.c:160-205 + 600-680;
src/layout/dot/graph-label.ts; src/layout/dot/init.ts;
src/common/postproc.ts

## Interface contract (consumed by T4)

`g.info.label?: TextlabelT` with pos set by place_root_label and
set=true (check what C sets — place_root_label/do_graph_label
semantics; cite). GRAPH_LABEL bit on has_labels.

## Acceptance criteria

- Given `label="gl"` on the graph, when dot layout completes, then
  g.info.label exists, positioned per place_root_label (C default:
  bottom-centered), bb expanded to make room (do_graph_label/
  postprocess semantics — match C, verify against
  `dot -Tsvg` viewBox for the same input)
- Given labelloc="t", then top placement matches C
- Given no graph label, then conformant 67 goldens

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed. Commit (orchestrator):
`feat(T3): root graph label creation and placement`
