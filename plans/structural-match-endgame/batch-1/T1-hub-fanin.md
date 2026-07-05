# T1 — b29/b124 hub-fanin long-edge chains
model: fable · isolation: worktree · output: analysis/hub-fanin.md (contract: decisions.md)

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
Ids: graphs-b29, share-b29, windows-b29, linux.i386-b29, graphs-b124, share-b124,
windows-b124 (Δ~1990-2590 on 1-3 paths each into high-fan-in hubs).
FIRST re-verify current deltas on main — the b15 collect/edgecmp rework landed
after the prior diagnosis (.agent-notes/hub-fanin-longedge-diagnosis.md, which
ruled OUT the b15 groupSize mechanism for b100/b104 but left b29/b124 open as a
distinct larger mechanism). If deltas moved/closed, verdict already-closed.
Else instrument both sides on the worst edge (b29 Node14650 in-edges) and pin
the mechanism. Read: plans/structural-match-buckets/analysis/bucket-edge-path.md,
.agent-notes/graphs-b15-collect-design.md, src/layout/dot/splines-groups.ts,
edge-route-chain.ts.

## Quality bar
Doc written to analysis/hub-fanin.md following the interface contract; every claim
backed by a repro command or instrumentation dump; journal row appended.
Boundaries: NEVER edit src/ in the main tree (you are in a worktree; your
worktree edits are throwaway instrumentation only).
