# Mission — render styling parity (color / fill / penwidth / line-style)

**Objective:** Make the live SVG render path emit per-object pen color,
fill color, pen width, and line style (dashed/dotted/bold) for nodes,
edges, clusters, and the graph background — matching C graphviz
15.0.0. Today the port renders **monochrome** for any non-HTML-table
graph: `style=filled`/`fillcolor` → `fill="none"`, `color` ignored
(`stroke="black"`), `penwidth` and `style=dashed/dotted` dropped,
`bgcolor` ignored. Root cause: `job.obj` (the per-object pen/fill
`ObjState`) is never populated during ordinary node/edge/cluster/graph
emission — the only production `pushObj` caller is the M12
`withHtmlPaint` helper, so `emitStyle` (src/render/svg-helpers.ts)
always takes its `obj===null` branch. This mission ports C's
`push_obj_state` lifecycle into the device walk and the style/fill
resolution helpers it depends on.

Gradient paint is OUT OF SCOPE (separate mission — `<linearGradient>`
/ `svg_gradstyle`); two-color fills fall back to their first solid
color as they do today.

## Branch

`feature/parity-render-styling` off `feature/post-parity`. Merge back
with a **merge commit** when all gates pass, on Scott's go-ahead.

## Canonical rules

- C source at `~/git/graphviz/lib/` (tag 15.0.0) is the spec; refs
  only from the installed 15.0.0 `dot` binary.
- NEVER modify existing refs, manifest entries, or tolerances;
  additions APPEND (carried AD-C1).
- One commit per task; re-read this README + decision-journal.md after
  every compaction.
- Agent prompts MUST include the hook rule: "if a pre-commit/length/CCN
  hook complains, smallest fix, at most 2 attempts per file, then move
  on." Hook limits: 30 lines/function, CCN 10, 5 params, 500 lines/file.

## Quality Gates (after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND passed >= 1466
  on_fail: fix_and_rerun
- command: OUTDIR=/tmp/rs-x npx tsx .probes/render-all.ts + byte-diff vs pre-task baseline
  pass: existing goldens conformant (82 until T6 lands, ~97 after)
  on_fail: stop
- command: git diff --name-only HEAD~1..HEAD
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1466 passed / 0 failed**, 82 goldens
(2026-06-13, post-M12-follow-up merge).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 (parallel) | [T1 style/color resolution helpers](batch-1/T1-style-resolution.md), [T2 obj-state lifecycle in the walk](batch-1/T2-objstate-lifecycle.md) | [x] |
| 2 (after 1; parallel) | [T3 node fill/pen/penwidth/style](batch-2/T3-node-styling.md), [T4 edge color/penwidth/style](batch-2/T4-edge-styling.md), [T5 cluster fill + graph bgcolor](batch-2/T5-cluster-graph.md) | [x] |
| 3 (after 2) | [T6 goldens + C-oracle verify](batch-3/T6-goldens.md) (orchestrator inline) | [x] |

## Stop conditions

- Change outside the active task's write-set
- 2 consecutive gate failures on the same check; same location/approach
  changed 3+ times for the same failure
- Implementation contradicts AD1–AD4 ([decisions.md](decisions.md))
- A divergence from the C oracle traces to code outside this mission's
  blast-radius table (M10/M11/M12 precedent — no silent fixes)
- A required behavior depends on gradient paint (out of scope) beyond
  the documented first-color solid fallback
- Numeric divergence with an FMA signature without disassembly evidence
  (src/common/fma.ts)

## Push-forward conditions (journal entry each)

- Hook-forced module splits; C function boundaries + @see preserved
- Probe design under .probes/ (untracked)
- Test-fixture repairs in files the task owns
- Trivially obvious fallback-chain fixes within a task's own files
- Folding the M12 anchor side-channel env (objId/objLabel/imgscale)
  into the real obj-state if T2 makes it natural (it currently lives in
  htmltable-emit-rules.ts as module state)

## Key references

- [decisions.md](decisions.md) — AD1–AD4 + carried rules
- [decision-journal.md](decision-journal.md) — append-only
- [diagrams/component-map.md](diagrams/component-map.md),
  [diagrams/data-flow.md](diagrams/data-flow.md)
- C: lib/common/emit.c (push_obj_state:108, emit_begin_node:1654,
  emit_background:1476, emit_begin_cluster:3758, emit_edge color/style
  blocks); lib/common/shapes.c:poly_gencode (stylenode/findFill/
  penColor); plugin/core/gvrender_core_svg.c (svg_*).
- M12 precedent: `withHtmlPaint` (src/common/htmltable-emit-fill.ts) is
  a working scoped-ObjState paint — the proof the rendering side works.

## Mission summary (2026-06-13 — COMPLETE, awaiting merge go-ahead)

**Tasks completed:** 6 / 6 (T1–T6), one commit each.

| Task | Commit | Result |
|------|--------|--------|
| T1 | `1198d3e` | style-resolve.ts pure resolvers (parse_style, findFill, penColor) |
| T2 | `b91a6dc` | createObjState() + C push/pop lifecycle in the device walk |
| T3 | `82d979d` | node fill/pen/penwidth/style via the obj-state |
| T4 | `2d68dea` | edge color/penwidth/style + colored arrows via the obj-state |
| T5 | `2f584ed` | cluster fill + graph bgcolor (+ resolveClusterFill) |
| T6 | `2c02b97` | 15 styled goldens vs dot 15.0.0; manifest 82→97 |

**Final gates (full branch):** `tsc --noEmit` 0 errors; `vitest run`
1584 passed / 0 failed; prior 82 goldens conformant to the mission
baseline (0 diffs); 15 new styled goldens pass at deterministic 0.01pt.

**Decisions of note (see decision-journal.md):**
- Batch 2 device.ts conflict (T4 renderEdge vs T5 renderOneCluster)
  resolved by serializing device.ts writers: Round 1 T3‖T4, Round 2 T5.
  T5's write-set was expanded to device.ts (renderOneCluster) +
  style-resolve.ts (resolveClusterFill) — the brief's flagged STOP, the
  orchestrator's call.
- `dot-styled-combined` golden uses ellipse edge endpoints: a `shape=box`
  endpoint exposes a pre-existing 0.11pt edge-spline divergence (box
  clipping geometry, outside this mission's blast radius — no silent fix,
  per stop conditions). The combined golden still exercises bgcolor +
  filled cluster + node fill + node pen + colored dashed edge together.

**Known follow-ups (out of scope, journaled):**
- Gradient / two-color fills (`<linearGradient>` / svg_gradstyle) — a
  separate mission; this port falls back to the first solid color (AD3).
- striped / wedged multicolor node fills — same gradient subsystem.
- Multi-color parallel-spline edges (`color="c1:c2"`) — first color only.
- Box-node edge-spline 0.11pt divergence — a layout/libm matter, not
  styling.

**Rollback:** reversible (one commit per task; no migrations).
**Merge:** ready for a **merge commit** into `feature/post-parity` on
Scott's go-ahead (NOT yet merged).
