# Batch 2 — fixes

F1 (2620) is fully specified now — its mechanism was pinned in a prior
mission. F2..Fn are authored BY THE EXECUTOR from the Batch-1 notes before
launching this batch:

1. Read the four Batch-1 notes. Collect every `classification:
   "shallow-fixable"` block.
2. Group by writeSet: fixes touching the same file collapse into ONE task
   (one writer per file — `~/.claude/rules/parallelism.md`).
3. Author `batch-2/FN-<slug>.md` per group using the template below; add a
   row to the task table; log the grouping to the decision journal.
4. `tracked-deep` blocks get NO fix task — they get a row in the "deferred"
   list at the bottom of this file plus their note (D4).
5. Verify no write-set overlap across F1..Fn, then launch dependency-free
   tasks in parallel.

NS-core rule (D2): any task whose writeSet touches `ns*.ts` / `position.ts`
runs SEQUENTIALLY (not parallel with anything), lands as its own commit, and
the executor runs `npm run survey && npm run survey:gate` immediately after —
regression → revert before anything else proceeds.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| F1 | 2620/2361-class: ortho maze build-order conformance | sonnet/high | `src/ortho/*` (+ its tests) | — | [ ] |
| F2 | 1879: read graph `pad` attr (init_job_pad port) | sonnet/high | `src/render/svg-helpers.ts`, `src/gvc/viewport.ts`, `src/render/svg-graph.ts`, job-construction file | — | [ ] |
| D5 | 1879 ltail long-chain pre-clip spline residual (diagnosis) | sonnet/high | `.agent-notes/1879-ltail-chain-spline.md` | — | [ ] |
| F4 | virtualNode id=0 faithfulness fix + 1718 measurement | sonnet/high | `src/layout/dot/fastgr.ts` | F1, F2, D5 (clean tree for survey) | [ ] |
| D6 | 2239 nested-cluster rank-axis compression (diagnosis) | sonnet/high | `.agent-notes/2239-cluster-rank-axis.md` | T1 | [ ] |
| F3 | BOUNDED feasibleTree order conformance (graphs-b51 7-node repro) | sonnet/high | `src/layout/dot/ns-subtree.ts` | runs LAST, sequential (D2) | [ ] |
| F5 | ltail chain-spline fix (only if D5 lands shallow-fixable) | sonnet/high | pinned by D5 | D5 | [ ] |
| F6 | graph-level `margin` attr unported (1879 residual, F2 follow-up) | sonnet/high | `src/gvc/*`, `src/render/svg-graph.ts` | F2 | [x] |
| F7 | AGSEQ node-iteration order at agfstnode-mirroring sites (from F3's root cause) | sonnet/high | `src/layout/dot/classify.ts`, `decomp.ts`, audited siblings | F3 | [ ] |

## Fix-task template (for F2..Fn)

```markdown
# FN — <mechanism one-liner>

## Context
<paste the source note's Mechanism/Origin/Causal chain verbatim>
## Task
Apply the minimal faithful fix at the origin (not a downstream symptom
patch). Port the C behavior exactly; JSDoc @see the C origin.
## Write-set
<from the note's writeSet + colocated .test.ts + the note file (append fix
record)>
## Read-set
<the note; the C reference file:lines; the port file>
## Acceptance criteria
- Given <id>.dot, when rendered with the fix, then flat-geom-diff's worst
  delta for the note's named elements is 0 (or the note's predicted bound)
- Given the full corpus survey, when run post-commit, then zero per-id
  verdict regressions and <id> improves per expectedVerdictDelta
- Given `npm run test`, then exit 0 (including the new regression test)
## Tests (TDD)
Write the failing regression test FIRST (golden or unit at the origin), then
fix. One commit: `fix(<scope>): <desc>` referencing FN.
## Observability: N/A — no new observable operations (library layout code).
## Rollback: Reversible — revert the single commit.
```

## Deferred (tracked-deep — filled during execution)

| id | evidence note | why deferred |
|---|---|---|
| 1879 (ltail spline residual) | `.agent-notes/1879-ltail-chain-spline.md` | raw pre-clip spline head-side control points differ; pinning needs C-side instrumentation (forbidden while the shared oracle serves concurrent tasks). Follow-up mission: instrument dotsplines.c per recover-slack-and-c-harness recipe, single-task, oracle cache rebuilt after. F5 cancelled (D5 not shallow-fixable). |
| 2620 (+2361 residual) | `.agent-notes/2361-ortho-maze-corridor-tiebreak.md` (F1 resolution appended) | D3 stop condition fired: maze/partition construction order EMPIRICALLY ruled out as the tie-break driver (A/B on 2361's real maze geometry, byte-identical routes). Remaining candidates need more than ordering changes: edge-routing order × updateWts congestion mutation interplay, or a C-vs-port cost divergence. F1's partition DFS-order fix kept as independent fidelity correction (9933511, 0 regressions). |
