# T5 — 2613 canvas-extent Δ50
model: sonnet · isolation: worktree · output: analysis/2613-canvas.md (contract: decisions.md)

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
Id: 2613 (svg/@height Δ50). Prior: NOVEL needs-C ('point-rankgap' note in
bucket-canvas-extent.md). Localize which element's bbox drives the extra 50pt
(top/bottom margin? rank gap around shape=point?). Compare per-node y extents
port vs oracle (the localization script pattern from the star session works).
Read: bucket-canvas-extent.md, memory 2613 row; src/layout/dot/position.ts
ranksep sites if rank-gap, src/common/emit bbox sites if margin.

## Quality bar
Doc written to analysis/2613-canvas.md following the interface contract; every claim
backed by a repro command or instrumentation dump; journal row appended.
Boundaries: NEVER edit src/ in the main tree (you are in a worktree; your
worktree edits are throwaway instrumentation only).
