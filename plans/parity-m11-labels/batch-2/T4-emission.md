# T4 — node-xlabel + root graph-label emission in the live render path

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Hook
rule: smallest fix, ≤2 attempts per file, then move on.

The live render path is src/gvc/device.ts + src/render/svg*.ts. M10
established the pattern: renderEdgeLabels in device.ts (ports
emit.c:emit_end_edge labels + labels.c:emit_label span placement) with
helpers labelFirstSpanY/labelSpanX, called from SvgRenderer.endEdge.
renderClusterLabel is the older same-pattern precedent. Do NOT call
into src/common/emit*.ts (dead family, incompatible RenderJob — it is
deleted later this mission in T7).

T1 created n.info.xlabel (placed by the already-ported addXLabels —
set=true after placement). T3 created+placed g.info.label.

## Task

1. Node xlabel: port emit.c:1829-1830 (`if (ND_xlabel(n) &&
   ND_xlabel(n)->set) emit_label(job, EMIT_NLABEL, ND_xlabel(n))`)
   into device.ts. Reuse the existing labelFirstSpanY/labelSpanX
   helpers (generalize renderOneEdgeLabel into a shared
   renderOneLabel if that is the smallest change — keep @see cites).
   Call site: renderNode, positioned to match C's emit_node order
   (read emit.c:1780-1840 — xlabel emits inside the node group after
   the shape codefn). Wire through SvgRenderer.endNode the same way
   endEdge calls renderEdgeLabels, so the text lands inside the node
   <g> like C's SVG output.
2. Root graph label: port the emit_page graph-label block
   (emit.c:emit_page → emit_label of GD_label) into the live
   renderGraph flow in device.ts at the C-equivalent point (before
   nodes/edges — verify against a C SVG: where does <text> for the
   graph label sit relative to node groups? Match it).
3. TDD: unit tests asserting <text> presence + position for a placed
   node xlabel and a graph label, plus absence when set=false.

## Write-set

src/gvc/device.ts, src/render/svg.ts (call-site lines only, if
needed), plus a co-located test file. Nothing else.

## Read-set

~/git/graphviz/lib/common/emit.c:1780-1840 (emit_node block),
emit_page graph-label block (grep GD_label in emit.c);
src/gvc/device.ts (renderEdgeLabels/renderClusterLabel patterns);
src/render/svg.ts; C oracle: `echo 'digraph G { A [xlabel="nx"]; A ->
B; }' | dot -Tsvg` for structural placement.

## Interface contract

None downstream — terminal emission. T5 compares full SVG against C.

## Acceptance criteria

- Given a placed node xlabel (set=true), when rendered, then <text> is
  inside the node's <g> at the C-structural position
- Given a placed graph label, then <text> appears where C puts it
  (verify group nesting against the oracle SVG)
- Given set=false or absent labels, then output conformant to
  pre-task baseline (67-golden probe)

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed. Commit (orchestrator):
`feat(T4): emit node xlabel and graph label in live render path`
