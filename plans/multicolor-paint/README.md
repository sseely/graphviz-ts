# Mission — multicolor paint (gradient / striped / wedged / multicolor edges)

**Objective:** Replace the AD3 "first-solid-color" fallbacks left by the
parity-render-styling mission with true multicolor output matching C
graphviz 15.0.0: linear/radial **gradient** fills (node, cluster, graph
bgcolor), **striped** and **wedged** multicolor node fills, and
**multi-color parallel-spline edges** (`color="c1:c2"`). The render path
already pushes a per-object `ObjState` (with unpopulated
`stopColor`/`gradientAngle`/`gradientFrac`) and resolves solid pen/fill;
this mission ports the multicolor color-list machinery and the SVG
gradient/stripe/wedge emission those fields feed.

## Branch

`feature/multicolor-paint` off `feature/parity-render-styling`. Merge
back with a **merge commit** when all gates pass, on Scott's go-ahead.

## Canonical rules

- C source at `~/git/graphviz/lib/` (tag 15.0.0) is the spec; refs only
  from the installed 15.0.0 `dot` binary.
- NEVER modify existing refs, manifest entries, or tolerances; additions
  APPEND (carried AD-C1).
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
  pass: exit 0 AND failed == 0 AND passed >= 1584 (grows as tasks add tests)
  on_fail: fix_and_rerun
- command: OUTDIR=/tmp/mc-x npx tsx .probes/render-all.ts + diff vs pre-task baseline
  pass: existing goldens byte-identical (97 until batch 4, ~97+N after)
  on_fail: stop
- command: git diff --name-only HEAD~1..HEAD
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1584 passed / 0 failed**, 97 goldens
(2026-06-13, post parity-render-styling).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 gradient | [G1 gradient resolution](batch-1/G1-gradient-resolution.md), [G2 gradient emitters](batch-1/G2-gradient-emitters.md), [G3 node+cluster gradient](batch-1/G3-node-cluster-gradient.md), [G4 graph bgcolor gradient](batch-1/G4-graph-bgcolor-gradient.md) | [x] |
| 2 striped/wedged | [S1 striped + wedged node fills](batch-2/S1-striped-wedged.md) | [x] (striped byte-parity; wedged feature done, libm byte-divergence journaled) |
| 3 multicolor edges | [M1 parallel-spline edges](batch-3/M1-multicolor-edges.md) | [x] (directed parallel edges byte-match; semicolon split-along-length + undirected routing are journaled follow-ups) |
| 4 goldens | [T-gold goldens + C-oracle verify](batch-4/T-gold-goldens.md) (orchestrator inline) | [ ] |

Intra-batch sequencing (single-writer-per-file):
- Batch 1: Round 1 **G1 ‖ G2** (disjoint), Round 2 **G3 ‖ G4** (disjoint;
  both depend on G1+G2). G1 builds the shared `multicolor.ts` parser
  (`parseSegs`) that `findStopColor` and Batches 2–3 all consume.
- Batch 2: **S1** alone (striped + wedged; consumes G1's parser).
- Batch 3: **M1** alone (consumes G1's parser).

## Stop conditions

- Change outside the active task's write-set.
- 2 consecutive gate failures on the same check; same location/approach
  changed 3+ times for the same failure.
- Implementation contradicts AD1–AD6 ([decisions.md](decisions.md)).
- A divergence from the C oracle traces to code outside this mission's
  blast-radius table (M10/M11/M12 precedent — no silent fixes).
- **Numeric divergence with an FMA/libm signature** in gradient trig
  (`get_gradient_points` sin/cos), wedge angles, or edge-offset geometry
  WITHOUT disassembly evidence (src/common/fma.ts) — STOP and journal
  (same class as the deferred box-node spline divergence; pin via
  tolerance+portReference per M8 precedent, do not chase a code fix).

## Push-forward conditions (journal entry each)

- Hook-forced module splits; C function boundaries + @see preserved.
- Probe design under .probes/ (untracked).
- Test-fixture repairs in files the task owns.
- Trivially obvious fallback-chain fixes within a task's own files.

## Key references

- [decisions.md](decisions.md) — AD1–AD6 + carried rules.
- [decision-journal.md](decision-journal.md) — append-only.
- [diagrams/component-map.md](diagrams/component-map.md),
  [diagrams/data-flow.md](diagrams/data-flow.md).
- C: lib/common/emit.c (findStopColor:4335, parseSegs:470,
  wedgedEllipse:549, stripedBox:595, multicolor:1975, emit_background
  gradient block ~1500, emit_clusters gradient ~3857); lib/common/utils.c
  (get_gradient_points:1446); lib/common/shapes.c:poly_gencode
  (GRADIENT/RGRADIENT/striped/wedged ~2980-3060);
  plugin/core/gvrender_core_svg.c (svg_print_stop:553, svg_gradstyle:572,
  svg_rgradstyle:608, svg_grstyle gradient branch, svg_ellipse/polygon/
  bezier gradient dispatch :650-690).
- Predecessor: plans/parity-render-styling/ (the mission that built the
  ObjState lifecycle + solid styling this one extends).
