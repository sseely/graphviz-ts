# T3 — twopi + circo self-loop divergence: debug and fix

## Context

graphviz-ts port; C source is the spec; suite baseline 1054/0.

Unlike dot (T2), twopi and circo ALREADY route self-loops: both
delegate to neato's splineEdgesShifted → splineEdges →
makeSelfArcs (src/layout/neato/splines.ts:169-177, 307, 322) →
makeSelfEdge (src/common/splines-selfedge.ts, fully ported). But the
output diverges from C:

- test/golden/quarantine/twopi-self-loop.{dot,svg}: maxDelta 18pt,
  viewBox/dimensions wrong
- test/golden/quarantine/circo-self-loop.{dot,svg}: maxDelta 2.0pt,
  bezier control points off

C call chain: lib/neatogen/neatosplines.c:652-680 spline_edges_ →
makeSelfArcs (line 213-245) → makeSelfEdge. twopi entry:
lib/twopigen/twopiinit.c; circo entry: lib/circogen/circularinit.c.
Suspects: aspect-ratio handling (neato_set_aspect), the stepx parameter
passed to makeSelfArcs, coordinate transforms between layout space and
spline space, bounding-box update after self-arc install.

## Task

This is a DEBUG task. Per AD4, use the full-precision C oracle: write a
small C probe (pattern in .agent-notes/fdp-fma-oracle-2026-06.md —
`cc -o /tmp/probe probe.c -I/opt/homebrew/opt/graphviz/include
-L/opt/homebrew/opt/graphviz/lib -lgvc -lcgraph -lcdt`) that runs
twopi/circo layout on the quarantined inputs and prints node positions
AND edge spline control points at %.17g. Diff against the port's values
(print from a TS probe) to localize the first divergent quantity, then
trace it to the responsible port code and fix it faithfully against the
C source. Probes live in .probes/ (untracked).

The two engines likely share a root cause (same machinery); check that
hypothesis first. Budget: per the consecutive-fix stop rule, if the
same location/approach is changed 3+ times without resolving the same
failing comparison, STOP and journal.

TDD where the fix is identifiable: failing unit test first, co-located
with the fixed module. Verify both quarantined goldens pass via the
compare.ts probe approach (no test/golden/ edits). Report; T5 promotes.

## Write-set

src/layout/neato/splines.ts, src/layout/twopi/pipeline.ts,
src/layout/circo/index.ts — ONLY as the root cause dictates (if the fix
lands elsewhere, that's a stop condition: journal and stop); one new
co-located *.test.ts next to the fixed module; .probes/* (untracked)

## Read-set

~/git/graphviz/lib/neatogen/neatosplines.c:200-260, 640-700;
~/git/graphviz/lib/twopigen/twopiinit.c;
~/git/graphviz/lib/circogen/circularinit.c;
src/layout/neato/splines.ts:150-340; src/layout/twopi/pipeline.ts;
src/layout/circo/index.ts; .agent-notes/fdp-fma-oracle-2026-06.md
(probe technique, FMA-contraction precedent — an FMA site is a
plausible root cause for the circo 2pt drift)

## Architecture decisions

AD4 (oracle methodology). C-is-sacred: fix = make the port match C,
never adjust expectations toward the port.

## Interface contract (consumed by T5)

Report: per golden (twopi-self-loop, circo-self-loop) — PASS/FAIL with
maxDelta; root cause(s) in one paragraph for the journal.

## Acceptance criteria

- Given the quarantined twopi-self-loop input, when compared to its
  ref, then it passes at twopi's tolerance class
- Given the quarantined circo-self-loop input, then it passes at
  circo's tolerance class
- Given the existing twopi/circo/neato goldens, then port output
  unchanged (suite 1054+/0)
- Given the root cause, then a unit test pins the fixed quantity

## Observability: N/A. Rollback: Reversible.

## Quality bar

npx tsc --noEmit clean; npx vitest run green. Commit:
`fix(T3): <root cause> in twopi/circo self-loop geometry`
