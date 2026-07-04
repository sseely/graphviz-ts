# T1 — Diagnose the rank-extent family: 2521 (anchor), 1718, 2239

## Context
graphviz-ts is a faithful TypeScript port of C Graphviz (`~/git/graphviz` is
the spec; read the project `CLAUDE.md`). Three corpus ids diverge on
rank-axis bbox EXTENT, which triage says is a ranking/y (or LR rank-axis)
divergence upstream of edge splines:

- `2521` — 22-line digraph, 3 clusters, `{rank=same}` groups SPANNING
  clusters (`a1 b1`, `b2 c2`, `a3 b3 c3`). C bbox 354×348; port 339×313
  (height Δ35). Worst node `a3` Δ144, `c3` Δ72 — whole nodes move in y.
- `1718` — 1029-line grid graph `rNcM` with long back edges (r15c0->r0c0).
  C height 21192; port 17476 (Δ3716). Edge coord-count diffs everywhere.
- `2239` — 713-line gstreamer-style graph, clusters + `rankdir=LR`.
  C width 12078; port 6799 (Δ5279 on the rank axis).

Hypothesis: one mechanism (cluster ranking / rank assignment producing fewer
or tighter ranks in the port) explains 2521 and possibly all three. 2521 is
the anchor: smallest repro, cross-cluster rank=same is the obvious suspect
(cluster-collapse ranking, `rank.c` / cluster skeleton merge).

## Prior observations (do not re-investigate)
- Memory `subgraph-edge-endpoint-rankset-done`: `A->{rank=same b c}->D`
  builder subgraph registration was already fixed.
- Memory `cluster-defect-d-is-node-induce-prune` + `errored-cluster-rc2-rc3`:
  cluster membership/ranking defect notes; RC2/RC3 (membership+ranking)
  deferred in `plans/cluster-membership-derisk` — 2521 may BE that class.
- Memory `2471-blocker-is-cluster-ranking` (superseded for 2471, but the
  cluster-ranking mechanics discussion may be relevant).

## Task
Diagnosis ONLY (rule `~/.claude/rules/diagnosis.md` — read it first). For
2521: instrument C vs port to find where rank assignment (per-node rank ids,
then y-coords) first departs. Dump per-node ranks on both sides (C:
`ND_rank`; port: node `info.rank`) after ranking, before mincross. Then check
whether the same mechanism explains 1718 and 2239 (dump their rank counts /
rank-extent on both sides; for 2239 the rank axis is x due to rankdir=LR).
If 1718 or 2239 has a DIFFERENT first divergence, pin that separately (still
diagnosis-only).

## Write-set
- `.agent-notes/path-structure-rank-extent.md` (the deliverable)
- Temporary env-gated instrumentation in `src/layout/dot/rank*.ts` and
  cluster-ranking files — MUST be reverted before finishing.

## Read-set
- `~/git/graphviz/tests/2521.dot` (22 lines — read fully), `1718.dot`,
  `2239.dot`
- C: `~/git/graphviz/lib/dotgen/rank.c` (cluster collapse + rank_set),
  `lib/dotgen/cluster.c` as needed
- Port: `src/layout/dot/rank*.ts`, cluster ranking code (locate via Serena
  `find_symbol` on `rank`, `collapse_sets`, `cluster_leader` equivalents)
- `plans/fix-path-structure-bucket/batch-1/overview.md` (note schema)
- `~/.claude/rules/diagnosis.md`

## Repro
```
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/2521.dot -o /tmp/2521.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/2521.dot dot > /tmp/2521.port.svg
node test/diagnostic/flat-geom-diff.mjs /tmp/2521.c.svg /tmp/2521.port.svg
```

## Architecture decisions (locked)
D1: diagnosis only — no fixes, no `agent-notes` beyond your note, revert all
instrumentation. See `plans/fix-path-structure-bucket/decisions.md`.

## Interface contract
Output note MUST follow the schema in `batch-1/overview.md`, one
`## Mechanism…` block per distinct mechanism found (2521 mandatory; 1718/2239
either "same mechanism, verified by <evidence>" or their own block).

## Quality bar
- `git status` clean except the note file when done.
- `npx tsc --noEmit` passes (proof instrumentation is fully reverted).
- The note states mechanism + C/port file:line + ruled-out list; no guesses.

## Boundaries
- Never: modify ns.ts/position.ts/mincross (other tasks own them); apply fixes.
- Ask first (log to decision journal + stop): editing C source in
  `~/git/graphviz` (shared tree).
