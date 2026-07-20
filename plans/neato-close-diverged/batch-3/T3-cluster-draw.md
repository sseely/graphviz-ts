<!-- SPDX-License-Identifier: EPL-2.0 -->

# T3 · B3 — cluster-draw under neato

## Context

Faithful Graphviz C port. **B3 bucket** (pre-B1: `graphs-clust1`, `share-clust1`,
`windows-clust1`, `graphs-url` — confirm the residual in `residual-tracker.md`;
`share-`/`windows-` are mirror duplicates of `graphs-clust1`, so the distinct
graphs are `clust1` and `url`). Symptom: `cluster:… _draw_` polygon corner
diverges, e.g. `graphs-clust1`: `cluster_c1 …unfilled_polygon[0]: 197.96 vs
197.22`. Neato registers clusters post-layout via `addClusters`
(`src/layout/neato/index.ts:224`, `@see neatoinit.c:addCluster`) and
`computeSubgraphBB` computes the tight cluster bbox.

## Task (diagnosis-first)

1. Run in a **git worktree** (`isolation: worktree`).
2. Reproduce the residual B3 ids. For each, get the firstDiff and identify which
   cluster bbox corner is off and by how much.
3. Instrument the cluster bbox path: `addClusters` → `computeSubgraphBB(subg, 0)`
   at `src/layout/neato/index.ts:229`. Compare against C
   `~/git/graphviz/lib/neatogen/neatoinit.c:addCluster` and
   `compute_bb`/`CL_OFFSET` margin handling. Prior cluster lessons:
   `~/.claude` memory "cluster-label family", "contain_nodes vStart-window",
   "cluster layout fixes" (clusterMargin unread; separate_subclust swapped args).
4. Fix at origin. If a residual B3 item is actually a cascade of a T1 node move
   (bbox follows a contained node), mark `cascade-of-known-parent` — no new fix.

## Write-set

- `src/layout/neato/index.ts` (the `addClusters` region, ~206-234)
- the cluster-bbox helper this proves to be the origin (likely in
  `src/layout/pack/index.ts` `computeSubgraphBB` or a neato cluster module) —
  declare it in the journal before editing; if it is `src/layout/pack/*` (shared
  with T5's base), coordinate per batch-3 overview file-ownership rule.

## Read-set

- `residual-tracker.md` (B3 rows) · `decisions.md#closed`
- `src/layout/neato/index.ts:206-234` · `computeSubgraphBB` in `src/layout/pack/`
- C: `~/git/graphviz/lib/neatogen/neatoinit.c` (addCluster), `lib/pack/pack.c`

## Acceptance criteria

- **Given** each residual B3 id, **when** re-rendered, **then** it passes at 0.5pt
  OR is classified (fix / accept / cascade) with a `known-divergences.md` entry.
- **Given** `bash test/golden/gates.sh` in the worktree, **then** exit 0.
- **Given** the broad sweep in the worktree, **then** 0 previously-passing ids
  regress (BY ID) in neato + dot + circo/twopi/osage/patchwork.

## Observability / Rollback

N/A / Reversible.

## Commit

`fix(T3): <mechanism> in neato cluster bbox`.
