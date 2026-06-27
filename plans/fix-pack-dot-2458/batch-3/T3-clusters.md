# T3 — copyClusterInfo + cluster-carry (TDD)

## Context

graphviz-ts is a faithful TS port of C Graphviz (`~/git/graphviz` = spec). T2 landed
the cluster-free `doDot` pack branch (2458). This task extends it to **clustered
multi-component** graphs, porting C's `copyClusterInfo`/`copyCluster`/`mapClust`
(`dotinit.c:388-432`): after packing, copy each component's cluster tree (bb, label,
border, nested clusters) back to the root so cluster rectangles render at packed
positions.

For this to work, each `ccomps` component must **carry its cluster subgraphs** (the
port's `buildSubgraph` copies only nodes+edges). ADR-3: add a dot-local cluster-carry
step in `pack-components.ts` — do NOT modify `src/layout/pack/**`.

**Read T1's findings first:** `comparisons/T1-investigation.md` —
`clusterCarryNeeded` and `clusterOracleCase` (the real corpus id or the synthetic
graph to use as the golden).

## Task

1. Cluster-carry: when decomposing for layout, ensure each component subgraph
   includes the cluster subgraphs whose nodes it owns (so `dotLayoutPipeline(sg)`
   builds `GD_clust`/cluster bbs).
2. Port `copyClusterInfo(ncc, ccs, root)` + `copyCluster(scl, cl)` (recursive) +
   `mapClust` faithfully: aggregate each component's clusters onto the root, copying
   bb/label/border and recursing into nested clusters; transfer the cluster label to
   the original cluster as C does.
3. TDD: add the cluster golden (T1's oracle) + unit test that fails first (Red), then
   the minimal faithful change (Green). Cite `@see lib/dotgen/dotinit.c:copyClusterInfo`.

## Read-set

- `comparisons/T1-investigation.md` (clusterCarryNeeded, clusterOracleCase)
- `src/layout/dot/pack-components.ts` (T2 output — extend)
- `src/layout/dot/index.ts` (doDot — wire copyClusterInfo after packSubgraphs)
- C: `~/git/graphviz/lib/dotgen/dotinit.c:388-432` (copyCluster/copyClusterInfo),
  and `mapClust` (grep its definition)
- The port's cluster model: `src/layout/dot/cluster.ts`, `g.info.clust`/`n_cluster`,
  cluster bb fields (grep `n_cluster`, `clust`, cluster `bb`)

## Write-set

- `src/layout/dot/pack-components.ts` (extend — cluster-carry + copyClusterInfo)
- `src/layout/dot/pack-components.test.ts` (extend)
- `src/layout/dot/index.ts` (only if doDot wiring requires the copyClusterInfo call)
- `test/golden/inputs/pack-clusters-*.dot` (create — T1's oracle or synthetic)
- `test/golden/refs/pack-clusters-*.svg` (create — headless 15.1.0)

## Architecture decisions (locked)

ADR-3 (dot-local cluster-carry; never touch pack/twopi modules), ADR-5 (15.1.0
oracle, structural-match bar).

## Interface contract

**In (from T2):** `{ doDotFn, packComponentsModule }`.
**Out (→T4):** `{ clusterGoldenInput, clusterGoldenRef, commitSha }`.

## Acceptance criteria

- Given a clustered multi-component graph (T1's oracle), when packed, then each
  component's cluster rectangles render at their packed positions and the output
  structurally matches headless 15.1.0.
- Given nested clusters, when copied back, then each nesting level's bb + label is
  reproduced (assert on a nested-cluster fixture).
- Given the T2 target, when re-run, then 2458 stays match (no regression of the
  cluster-free path).
- Given the change, when `npx tsc --noEmit --stableTypeOrdering` + `npx vitest run`,
  then both exit 0, all new tests green.
- Given the diff, when `git diff --name-only`, then it lists only the declared
  write-set.

## Boundaries

- **Never:** modify `src/layout/pack/**`/`src/layout/twopi/**`; widen beyond the
  declared write-set.
- **Always:** file ≤500 lines, fn CCN ≤10, params ≤5; `@see` the C line per ported
  function.

## Observability / Rollback

N/A — layout-internal. Reversible.

## Commit

`feat(T3): port copyClusterInfo + cluster-carry for packed dot components`
