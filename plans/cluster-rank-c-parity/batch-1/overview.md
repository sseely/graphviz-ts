# Batch 1 — fix recursive local subcluster ranking

The core fix. `dot1Rank(subg)` must rank a collapsed cluster's internal nodes
(currently all 0). TDD: write the failing rank assertion first.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|-----------|------|
| T1 | Fix `dot1Rank(subg)` all-zero local ranks + TDD unit test | `rank.ts`, `rank.test.ts` (+`classify.ts`/`cluster.ts` per AD-1) | — | [ ] |

## C spec anchors

- `dot1_rank` sequence — `rank.c:503-518` (collapse_sets→class1→…→rank1→expand_ranksets)
- `collapse_cluster` (local rank step 1) — `rank.c:327-343`
- `interclust1` offset (needs nonzero local ranks) — `class1.c:33-60`
- `rank1`/`rank` network simplex over components — `rank.c:455-468`

## Probe-confirmed facts (do not re-derive)

- `collapseCluster` runs 6× on the 6-cluster chain; `clType===LOCAL`.
- `dot1Rank(subg)` returns local ranks `0,0,0,0` for a 4-node cluster chain.
- `interclust1` fires 10× with offsets all `tR=0 hR=0 ml=1 off=1`.
- `class1`/`interclust1`/`setMinmax`/`expandNode` themselves are faithful — the
  defect is that subcluster internals are never locally ranked.

## Likely fault sites (investigate in order)

1. `rank1(subg)` / `g.info.comp` — is `decompose(subg,0)` populating components
   so `rank1` actually runs network simplex on the subcluster? (all-zero ranks
   == simplex never ran on those nodes)
2. Edge induction — after `nodeInduce`, do subcluster nodes retain their
   intra-cluster in/out edges for `class1(subg)` to build constraints from?
3. `class1(subg)` virtual-edge build over the subgraph.
