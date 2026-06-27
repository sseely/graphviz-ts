# Batch 3 — copyClusterInfo + cluster-carry

Extends the T2 pack branch to handle clustered multi-component graphs: components
carry their cluster subgraphs, `dotLayoutPipeline` builds `GD_clust`, and
`copyClusterInfo` maps cluster bb/label back to the root. TDD against T1's cluster
oracle (real corpus case or synthetic). Sequential after T2 (shares `index.ts` +
`pack-components.ts`).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | cluster-carrying component builder + copyCluster/copyClusterInfo/mapClust; cluster golden+unit test | (inline / general) | `src/layout/dot/pack-components.ts`, `src/layout/dot/pack-components.test.ts`, `src/layout/dot/index.ts` (only if wiring requires), `test/golden/inputs/pack-clusters-*.dot`, `test/golden/refs/pack-clusters-*.svg` | T2 | [ ] |
