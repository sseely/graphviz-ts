# T1b — dot-minlen residual offset: debug + fix

## Context

graphviz-ts port; C source at ~/git/graphviz/lib is the spec; suite
baseline 1090/0 (post batch-1).

Batch-1 T1 made dot read minlen/constraint attrs correctly;
dot-constraint-false promoted. dot-minlen
(test/golden/quarantine/dot-minlen.{dot,svg}) still fails at maxDelta
4.32pt (deterministic tolerance 0.01): ranking is CORRECT
(`A->B[minlen=2]` yields rank span 2), but node A sits at
cx=63/cy=−198 vs ref cx=62/cy=−199 (1pt offset) and the A→C edge
spline takes a structurally different path. So the divergence is in
position/spline computation when minlen>1 stretches an edge across
multiple ranks — not in attr init. Full signature:
.agent-notes/dot-minlen-offset-2026-06.md.

Hypotheses (unverified): x-coordinate pass (position.ts) handling of
the virtual-node chain created for the multi-rank A→B edge; bb/emit
rounding; A→C flat/skew edge routing interacting with the virtual
chain. The "pre-existing emitter rounding" guess from T1 was NOT
verified — treat it as one hypothesis among these.

Human ruling (Scott, 2026-06-11): figure out the bug and fix it; wide
write-set pre-approved.

## Task

DEBUG task, oracle methodology (AD4): build a C probe (pattern:
`cc -o /tmp/probe probe.c -I/opt/homebrew/opt/graphviz/include
-L/opt/homebrew/opt/graphviz/lib -lgvc -lcgraph -lcdt`) running dot
layout on the quarantined dot-minlen.dot, printing node positions
(incl. virtual nodes if reachable) and edge spline control points at
%.17g. Mirror with a TS probe. Localize the FIRST divergent quantity,
trace to the responsible port code, fix faithfully against the C
source (dotgen position/x-coord pass: lib/dotgen/position.c,
mincross/spline interplay as the trail dictates). Never guard-bisect;
for hangs use --prof (see .agent-notes/cluster-hang-2026-06.md).

Consecutive-fix stop rule: same location/approach changed 3+ times
without resolving the same failing comparison → STOP and report.

TDD: failing unit test pinning the fixed quantity, co-located with the
fixed module. Verify the quarantined dot-minlen golden passes via the
compare.ts probe approach (no test/golden/ edits); T5b promotes.

## Write-set

As the root cause dictates, EXCEPT: never touch test/golden/*, and
never touch src/common/splines-clip.ts or src/layout/neato/splines.ts
(owned by a parallel task — if your root cause lands there, STOP and
report instead). One new/extended co-located test; .probes/*
(untracked).

## Read-set

.agent-notes/dot-minlen-offset-2026-06.md;
~/git/graphviz/lib/dotgen/position.c (x-coord pass);
~/git/graphviz/lib/dotgen/dotsplines.c (edge classes for multi-rank
edges); src/layout/dot/position.ts; src/layout/dot/splines.ts;
test/golden/compare.ts + test/golden/suite.test.ts (probe entry
points, read-only)

## Architecture decisions (locked)

AD4 oracle methodology. C-is-sacred: fix = make the port match C.
AD5: promotion is T5b's job.

## Interface contract (consumed by T5b)

Report: dot-minlen PASS/FAIL with maxDelta; root cause in one
paragraph for the journal; files changed.

## Acceptance criteria

- Given the quarantined dot-minlen input, the comparison passes at dot
  tolerance (deterministic)
- Given the existing 60 goldens, port output unchanged (suite
  >=1090/0)
- Given the root cause, a unit test pins the fixed quantity

## Quality bar

npx tsc --noEmit clean; npx vitest run green (>=1090/0). Commit
message (orchestrator commits): `fix(T1b): <root cause> in dot
<area>`
