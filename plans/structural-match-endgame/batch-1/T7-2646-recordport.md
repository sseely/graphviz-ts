# T7 — 2646 record-port sub-port residual
model: sonnet · isolation: worktree · output: analysis/2646-recordport.md (contract: decisions.md)

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
Id: 2646 (Δ42.09 on one path@d; 30k-element graph — render is ~5min, be
patient; standalone only, machine idle). Prior: NOVEL needs-C. Localize the
divergent edge (g[30201]); it targets a record sub-port. Compare the port
resolution (record field box) both sides; memory b15-record-ports-done +
html-nested-table-ports covers adjacent mechanisms. Read:
src/common/shapes.ts record port resolution, splines-clip port stash.

## Quality bar
Doc written to analysis/2646-recordport.md following the interface contract; every claim
backed by a repro command or instrumentation dump; journal row appended.
Boundaries: NEVER edit src/ in the main tree (you are in a worktree; your
worktree edits are throwaway instrumentation only).
