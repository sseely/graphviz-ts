# Batch 1 — parallel diagnosis

Four read-only-ish diagnosis tasks. Deliverable per task: a mechanism note in
`.agent-notes/` following the schema below. NO fixes in this batch. Temporary
instrumentation must be env-gated and fully reverted before the task ends
(`git diff` clean except the note file).

Instrumentation file OWNERSHIP (avoids parallel write collisions):
- T1 owns ranking/cluster-rank code (`src/layout/dot/rank*.ts`, cluster
  ranking files).
- T2 owns emit/bbox (`src/render/*`, `src/common/emit*`) — if its trace lands
  in T1/T4 territory, record the finding and stop there.
- T3 owns mincross/ordering (`src/layout/dot/mincross*`) — if its first
  divergence is x-NS, record and stop (T4 owns NS).
- T4 owns `src/layout/dot/ns*.ts` + `position.ts` instrumentation (XNSDBG
  pattern).
- C-side instrumentation of `~/git/graphviz` is shared state: prefer existing
  debug flags (`-Godb=r` for ortho); if a task must edit C source, it takes
  the C tree exclusively for that period and rebuilds clean afterward
  (note: oracle cache is keyed by binary mtime — rebuilding invalidates it;
  restore a clean build when done).

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | rank-extent family: 2521 (anchor), verify vs 1718, 2239 | sonnet/high | `.agent-notes/path-structure-rank-extent.md` | — | [ ] |
| T2 | 1879 bbox + translate-x divergence | sonnet/high | `.agent-notes/path-structure-1879.md` | — | [ ] |
| T3 | 1447 node-x shifts (ortho downstream) | sonnet/high | `.agent-notes/path-structure-1447.md` | — | [ ] |
| T4 | x-NS residuals: graphs-b51, 2475_2 | sonnet/high | `.agent-notes/path-structure-xns-residuals.md` | — | [ ] |

Observability: N/A for all Batch-1 tasks — no code lands (diagnosis notes
only). Rollback: Reversible — delete the note file; instrumentation is
reverted within each task.

## Required note schema (consumed verbatim by Batch-2 fix tasks)

```markdown
## Mechanism
<one or two sentences>
## Origin
<file:line — both C reference and port>
## Causal chain
<why the observed symptom follows>
## Ruled out
<what was eliminated + the evidence>
## Fix target
{ fixTarget: "<port file :: symbol>", writeSet: ["<files>"],
  sharedMechanismWith: ["<other bucket ids or []>"],
  expectedVerdictDelta: "<id: diverged -> structural-match|conformant>",
  classification: "shallow-fixable" | "tracked-deep" }
```

`tracked-deep` requires the D4 evidence bar (e.g., a cost-equality proof like
blok_60's, or an upstream-oracle-bug citation).
