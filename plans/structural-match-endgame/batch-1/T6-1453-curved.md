# T6 — 1453 constraint=false under concentrate+curved
model: sonnet · isolation: worktree · output: analysis/1453-curved.md (contract: decisions.md)

## Context
Faithful TS port of C graphviz (~/git/graphviz = spec). Corpus survey verdicts
in test/corpus/parity.json; render one graph:
`GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/<path> dot`
vs oracle `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg <path>`.
Diff with compareSvg (test/golden/compare.ts, tolerance-class deterministic).
C-instrumentation recipe: memory recover-slack-and-c-harness (/tmp/gvplugins).
Diagnosis discipline per ~/.claude/rules/diagnosis.md: mechanism, origin
file:line, causal chain, ruled-out WITH evidence. No fix in this task.

## Task
Id: 1453 (polygon-points Δ465, arrowhead vertex — an edge routed very
differently). Prior: .agent-notes/1213-constraint-false-spline-divergence.md +
plans/fix-1213-splines/decisions.md (1213 fixed; 1453 left). Memory
nan-a2-retired-lane-order-done says routeCurvedGroup lane-order sort is OPEN —
prime suspect for curved parallel groups. Verify whether the C collected-order
sort (MAINGRAPH-first) applied to routeCurvedGroup closes 1453's route choice.
Read: src/layout/dot/splines-groups.ts routeCurvedGroup, the 1213 notes.

## Quality bar
Doc written to analysis/1453-curved.md following the interface contract; every claim
backed by a repro command or instrumentation dump; journal row appended.
Boundaries: NEVER edit src/ in the main tree (you are in a worktree; your
worktree edits are throwaway instrumentation only).
