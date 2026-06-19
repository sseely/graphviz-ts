# Batch 1 — bezier-segmentation parity (jcctree, p2, pm2way)

Sequential: T2's fix depends on T1's diagnosis (the divergent function and the C
ground-truth control-point dumps).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Instrument C; dump the spline control-point list (count+coords) for jcctree & p2; locate the exact port function whose fit diverges | opus | `plans/spline-segmentation/decision-journal.md` (findings only; read-only to `src/`) | — | [x] |
| T2 | Faithfully port the C spline-fit branch so jcctree/p2/pm2way reach byte/structural-match; add a test | opus | `src/render/svg-helpers.ts` (emission fix — see journal; T1 found build is faithful) | T1 | [x] |

## Interface (T1 → T2)
T1 writes to the decision journal:
```
{ divergentFn: "<port function + file:line>",
  cRef: "<lib/dotgen/...c:line>",
  cControlPoints: [count, ...coords],
  portControlPoints: [count, ...coords],
  rootCause: "<one line: why the counts differ>" }
```
T2 consumes `divergentFn` + `rootCause` to scope its write-set.

## Stop conditions
Per README. Specifically: if T1 finds the divergence is routing-POSITION
(large-delta), not segmentation → STOP and report (out of scope).

## Quality gates
Run all gates from [../README.md](../README.md) after each task. Snapshot
`cp test/corpus/parity.json /tmp/parity-before-T<n>.json` before T2's survey run;
diff per-id after.
