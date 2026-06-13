# T2 — obj-state lifecycle in the device walk (AD1)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Suite
baseline 1466/0, 82 goldens. Hook rule: smallest fix, ≤2 attempts per
file, then move on.

`RenderJob` already has `pushObj`/`popObj` and an `ObjState` interface
(src/gvc/job.ts), and `emitStyle` (src/render/svg-helpers.ts) already
reads `job.obj`. But NOTHING in the device walk pushes a populated
ObjState — the only production `pushObj` caller is `withHtmlPaint`. So
`job.obj` is null during all ordinary emission and `emitStyle` emits
monochrome. C pushes per object: `emit_begin_node` → `push_obj_state`
(emit.c:1654), `emit_begin_cluster` (3758), the graph (3573), edges in
emit_edge; pops at the matching end.

This task wires the lifecycle with a DEFAULT ObjState (reproducing
today's exact output); batch 2 populates it per object via T1's
resolvers. The M12 anchor side-channel (objId/objLabel/imgscale module
state in htmltable-emit-rules.ts) MAY fold into the real ObjState here
if natural (push-forward — journal it); otherwise leave it and only add
the lifecycle.

## Task

1. src/gvc/job.ts: extract the test-only `makeObjState` (currently in
   src/render/svg.test.ts:28) into a production `createObjState()`
   factory returning C's default object state (penColor black,
   fillColor white, pen Solid, fill None, penWidth 1.0, empty rawStyle,
   all url/tooltip/target null). Do NOT change the ObjState interface.
   @see lib/common/emit.c:push_obj_state (default init).
2. src/gvc/device.ts: in `renderNode`, `renderEdge`, the cluster path
   (`renderClusters`/cluster body), and the graph path (`renderGraph`),
   push `createObjState()` before the object's emission and pop after —
   mirroring emit_begin_*/emit_end_* push/pop ordering EXACTLY (C order
   is golden-sensitive). The pushed state is the DEFAULT here; batch 2
   sets colors on it. Preserve the existing anchor-env calls
   (setHtmlAnchorObj etc.) — they can read from the new obj or stay,
   agent's call (journal if folded).
3. TDD: failing tests first — e.g. after renderNode, job.obj is non-null
   during codefn and null (popped) after; an unstyled node still emits
   `fill="none" stroke="black"` (the default state must reproduce it).

## Write-set (strict — nothing else)

src/gvc/device.ts, src/gvc/job.ts (factory only), + their co-located
test files. svg.test.ts's makeObjState may be re-pointed to the new
factory (1-line import change is allowed in that test file as a
pre-existing-violation cleanup — journal it).

## Read-set

~/git/graphviz/lib/common/emit.c (push_obj_state:108, pop_obj_state:132,
emit_begin_node:1654/emit_end_node:1794, emit_begin_cluster:3758, graph
:3573); src/gvc/device.ts:70-310; src/gvc/job.ts (ObjState,
pushObj/popObj, obj getter); src/render/svg.test.ts:28-50 (makeObjState
shape); src/render/svg-helpers.ts:112-123 (emitStyle — what it reads).

## Architecture decisions (locked)

AD1 (this task — one obj-state stack, C lifecycle). The default state
MUST make emitStyle reproduce today's output for unstyled objects
(byte-stability). withHtmlPaint stays as a nested push on top.

## Interface contract (consumed by T3, T4, T5)

`createObjState(): ObjState` exported from src/gvc/job.ts. During
renderNode/Edge/Cluster/Graph, `job.obj` is the pushed (initially
default) state; batch-2 tasks mutate `job.obj.fillColor` / `.penColor`
/ `.pen` / `.penWidth` / `.fill` before the shape draw.

## Acceptance criteria

- Given a default node, when renderNode, then `job.obj` is non-null
  inside the codefn and the stack is balanced (null again after)
- Given an unstyled graph, when rendered, then SVG byte-identical to
  pre-task (82 goldens) — the default ObjState reproduces monochrome
- Given nested withHtmlPaint (html label on a node), then it pushes and
  pops correctly on top of the node's obj-state (M12 html goldens stay
  byte-identical)
- Given the suite, then 0 failed; 82 goldens byte-identical

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed; byte-stability probe
clean. No per-node ObjState garbage in a hot loop if avoidable (pool or
reuse where C does — note any deviation). Commit (orchestrator):
`feat(T2): push C obj-state lifecycle through the device walk`.
