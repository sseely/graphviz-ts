# T2 — 2413_1/_2 labeled 2-cycle back-edge vspace
model: fable · isolation: worktree · output: analysis/2413-vspace.md (contract: decisions.md)

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
Ids: 2413_1 (Δ67.65 path@d), 2413_2 (Δ1922 path@d). Labeled 2-cycle back edges;
prior bucket note: NOVEL, needs-C. Suspect vspace/label reservation for the
back edge of a labeled 2-cycle. Read: bucket-edge-path.md §2413,
src/layout/dot/splines-selfedge.ts, splines-groups.ts back-edge paths, memory
2cycle-backedge-fix-done + backedge-bbox-clip-fix-done (prior 2-cycle work).

## Quality bar
Doc written to analysis/2413-vspace.md following the interface contract; every claim
backed by a repro command or instrumentation dump; journal row appended.
Boundaries: NEVER edit src/ in the main tree (you are in a worktree; your
worktree edits are throwaway instrumentation only).
