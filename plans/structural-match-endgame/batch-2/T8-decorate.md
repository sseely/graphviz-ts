# T8 — graphs-decorate cluster-corridor
model: sonnet · branch: one per task, squash-merge after BATCH gate

## Context
Faithful port; C at ~/git/graphviz is the spec. Local validation before the
batch gate: target ids re-rendered + compareSvg 0-regression on the family's
control set, unit suite, typecheck. Diagnosis discipline applies to any
observed discrepancy (state mechanism before fixing).

## Task
graphs-decorate Δ43.54 worst on g[25]/polyline (a decorate connector); 23
diffs spread over cluster-crossing edge splines (~13pt) in a 2-level cluster
state machine; canvas already matches. Diagnose the corridor divergence for
ONE worst edge (Se3ffa656...->Se3ffa61c...), then fix at the mechanism.
Write-set (provisional, ≤3 files in splines cluster-corridor area):
src/layout/dot/splines-groups.ts and/or cluster corridor helpers + test.
Read: memory 1624-flat-corridor-makefwdedge, cl-bound-cluster-corridor-done,
faithful-corridor-minw-per-rank; C ref lib/dotgen/dotsplines.c corridor code.
## Acceptance
- Given decorate.gv, when rendered, then maxΔ < 1 (target conformant)
- Given 1332/compound/clust1-5 controls, when re-rendered, then 0 new diffs

## Quality bar
Target id(s) improved (ideally conformant); named controls 0-diff; vitest +
tsc clean; focused regression test added; one commit (conventional, ≤72-char
subject); write-set respected — need more files → ASK (decisions.md).
