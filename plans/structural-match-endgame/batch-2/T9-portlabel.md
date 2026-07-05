# T9 — 144_ortho + graphs-arrowsize portlabel splines
model: fable · branch: one per task, squash-merge after BATCH gate

## Context
Faithful port; C at ~/git/graphviz is the spec. Local validation before the
batch gate: target ids re-rendered + compareSvg 0-regression on the family's
control set, unit suite, typecheck. Diagnosis discipline applies to any
observed discrepancy (state mechanism before fixing).

## Task
Both ids diverge on head/tail label text positions (Δ34.6/19.4) whose
place_portlabel inputs (pe/pf from spline ends) are verified-faithful — the
SPLINES differ upstream: arrowsize.gv = splines=true + samehead + arrowsize=2
(memory honda-edge-spline-samehead-done covers samehead base); 144_ortho =
ortho + labels. Diagnose the upstream spline divergence per graph (they may be
two mechanisms — if so document both, fix what is pinned, journal the other).
Write-set (provisional): the pinned spline site(s) + tests; ASK if it crosses
subsystems.
## Acceptance
- Given arrowsize.gv, when rendered, then head/tail label x/y match ≤0.01
- Given 144_ortho, when rendered, then text positions match ≤0.01
- Given honda-tokoro + ports controls, when re-rendered, then 0 new diffs

## Quality bar
Target id(s) improved (ideally conformant); named controls 0-diff; vitest +
tsc clean; focused regression test added; one commit (conventional, ≤72-char
subject); write-set respected — need more files → ASK (decisions.md).
