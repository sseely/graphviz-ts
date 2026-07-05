# T4 — polypoly rotated-4-gon float sensitivity
model: sonnet · isolation: worktree · output: analysis/polypoly.md (contract: decisions.md)

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
Bounded pass per D1. Ids: graphs/share/windows-polypoly (Δ6.5-10.4, ~1400
sub-pixel diffs across every vertex). Prior: bucket-polygon-points.md — rotated
diamond ellipse-fit float sensitivity in poly-sizing.ts:164-185, needs-C.
Instrument ONE divergent vertex chain: dump C's intermediate ellipse-fit values
vs the port's; find the first divergent operation. If it is sub-ULP noise in a
shared primitive → accept (A7-style evidence). If a real formula gap → verdict
fix + locus. Read: src/common/poly-sizing.ts:150-200, memory
instrument-c-before-quarantine.

## Quality bar
Doc written to analysis/polypoly.md following the interface contract; every claim
backed by a repro command or instrumentation dump; journal row appended.
Boundaries: NEVER edit src/ in the main tree (you are in a worktree; your
worktree edits are throwaway instrumentation only).
