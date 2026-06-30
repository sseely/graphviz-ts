# Mission: cluster-rank C-parity

## Objective

Fix the TS dot **cluster-ranking** divergence that is the root cause of the
`tests/2471.dot` hang. `dot1Rank(subg)` (the recursive local ranking of a
collapsed subcluster, called from `collapseCluster`) leaves the cluster's
internal nodes at rank **0** — a 4-node chain inside a cluster gets local
ranks `0,0,0,0` instead of `0,1,2,3`. This makes `interclust1`'s leader-spacing
offset degenerate from 4 to 1, so chained clusters stack 1-apart and overlap
in rank space (TS **6 ranks** vs C **24** on a 6-cluster chain). The garbage
rank graph then feeds mincross the 26×-inflated input behind the 2471 hang.

## Root cause (probe-confirmed, 2026-06-17)

`collapseCluster` runs and calls `dot1Rank(subg)`, but the subcluster's nodes
all come back rank 0. `interclust1` offsets are all `tR=0 hR=0 off=1`. C ranks
the subcluster locally first (`collapse_cluster` → `dot1_rank(subg)`), giving
offsets up to 4. See `2471-blocker-is-cluster-ranking` memory + decisions.md.

## Branch / merge

- Branch: `feature/cluster-rank-c-parity` (off current `investigate/mincross-c-parity`).
- Merge to `main` with a **merge commit** (mission-brief branch).

## Constraints

**STOP when:** fix needs files outside the write-set (`rank.ts`,
`rank.test.ts`, `classify.ts`, `cluster.ts`); a regenerated clustered golden's
TS output ≠ the C binary; same rank-location changed 3× without resolving the
all-zero defect; 2 consecutive gate failures; cluster-free OR single-cluster
output changes (those match C today — any churn there is a regression).

**PUSH FORWARD when:** diagnosis points into `classify.ts`/`cluster.ts` in the
same call chain (AD-1); a clustered golden churns and new TS output == C
conformant (AD-2, regenerate from oracle); 2471 rank structure matches C but
it still doesn't fully render (AD-3 — perf gap is out of scope).

## Quality gates

- `npx tsc --noEmit` → exit 0
- `npx vitest run` → all pass; any churned golden regenerated from the C oracle
  and confirmed TS==C conformant (documented in journal)
- Hook limits: 30 lines/fn, CCN 10, 5 params, 500/file
- `git diff --name-only` ⊆ declared write-set + regenerated goldens

## Baseline (2026-06-17): tsc 0, vitest 1867. Cluster-free + single small
cluster + plain/HTML/RL/self-edge graphs already match C.

## Batches

| Batch | Focus | Status |
|-------|-------|--------|
| 1 | Fix recursive local subcluster ranking + TDD unit test | [x] |
| 2 | Regenerate clustered goldens (0 churn); ablation + 2471 rank verification | [x] |

## Outcome (2026-06-17)

**Fixed.** `nodeInduce` now ports C `node_induce`'s `agsubedge` step: root-scope
edges between cluster members are induced into the cluster subgraph, so its
local ranking sees them. Cluster chains stack correctly — 6-cluster chain
24r/54n == C; **2471 root rank structure 23r/3213n == C** (was 31/2197). Zero
golden churn; +2 unit tests (1869 pass); tsc 0.

**Out of scope (AD-3):** 2471 full render still hangs — a *newly-surfaced*
downstream divergence in cluster-aware mincross (`mincross_clust`: C reduces
crossings 4→0 on the now-correct graph, TS holds at 4). Recommend a follow-up
`mincross-clust-c-parity` mission. The `setMincrossTrace` harness + ablation
reproducers carry over.

## Verification harness

C: `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -v FILE`
(`Maxrank=`/STATS lines). TS rank probe: temporary dump of subcluster local
ranks + `interclust1` offsets (revert after). Ablation reproducers + STATS
recipe in the `2471-blocker-is-cluster-ranking` memory. Minimal repro:
6-cluster chain (each cluster = 4-node chain), C 24r/54n vs TS 6r/24n.

## Index

- [decisions.md](decisions.md)
- [batch-1/overview.md](batch-1/overview.md) · [batch-2/overview.md](batch-2/overview.md)
- [diagrams/component-map.md](diagrams/component-map.md) · [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)
