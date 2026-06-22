<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: cluster-membership-derisk — investigate cluster node/edge membership + ranking

## Type: investigation / derisk (NOT a fix mission)

Spun out of `plans/errored-cluster/` (2026-06-22) when 3 of its 4 "root causes"
turned out to be symptoms of one deeper subsystem gap. This mission's deliverable
is **a precise root-cause map + a scoped fix plan**, not (yet) the fix. The fix
mission is authored only after this investigation lands.

## Why this exists

`errored-cluster` fixed RC4 (parser) and RC1 (mincross flat-reorder windowing,
T2). T2 also incidentally fixed RC2's surface crash. But the remaining errored
cluster cases (1332, b53, 1767) all crash because the port's **cluster node/edge
membership and cluster ranks diverge from native C**:

- **Membership**: the port leaves *foreign* nodes in a cluster's node set
  (1767: `cluster_1` should be `{f}`, port has `{a,f,c}`; `cluster_2` should be
  `{p1,p2,p3}`, port has `{p1,p2,p3,f}`). C clusters hold only **owned** nodes
  (ND_clust == this cluster / first-cluster-wins).
- **Ranking**: rank=same cluster members are ranked inconsistently, and a
  subtree of clusters never gets its `info.rank` table installed (1332: clusters
  from `clusterc4118` onward; b53: `cluster_node_44`).

Both surface as null-derefs in `build_skeleton` (cluster.ts) and
`containNodesRank` (position-cluster.ts), but neither site is the cause.

## Objective

Produce, with native-C ground truth, a root-cause map answering:

1. **Membership**: Where does C reduce each cluster subgraph to its owned nodes
   before `class2`/`build_skeleton`? (Candidates: `mark_clusters`,
   `node_induce`, the working-graph rebuild, first-cluster-wins in `ND_clust`
   assignment.) Where does the port fail to mirror it? Is the port's
   `subg.nodes` the parse-time set (un-pruned)?
2. **Ranking**: Why do a subtree of clusters get `info.rank === undefined`
   (1332), and why are rank=same cluster members ranked inconsistently (1767)?
   Where in the ranking/cluster-install order does the port diverge?
3. **Blast radius**: Which modules must change (`cluster.ts`, `classify.ts`,
   `rank*.ts`, `mincross-build.ts`, `position-cluster.ts`?), and is there a
   single upstream fix that resolves 1332 + b53 + 1767 together?
4. **Secondary bug**: confirm the `build_skeleton` fixed-`rl` divergence (see
   below) and fold it into the fix plan.

## Cases (oracle-pinnable)

| Case | Surface crash (post errored-cluster T2) | Hypothesised real cause |
|------|------------------------------------------|--------------------------|
| 1767.dot | `buildSkeletonCountsNode` → `rankleader[v.rank]` undefined | foreign node `f` in cluster_2 + wrong rank=same ranks |
| 1332.dot | `containNodesRank` → `g.info.rank` undefined | cluster subtree never rank-installed |
| graphs/b53.gv | `containNodesRank` → `g.info.rank` undefined | last sibling cluster never rank-installed |

All three are small enough to instrument C directly and diff intermediate state.

## Confirmed findings carried over (start here, don't re-derive)

- **C `build_skeleton` ground truth (1767)**, native instrumented dump:
  `cluster_1={f:2}`, `cluster_2={p1:1,p2:1,p3:1}`, `cluster_3={S1:0,S2:0,S3:0}`.
  Port: `cluster_1={a:1,f:3,c:3}`, `cluster_2={p1:1,p2:0,p3:0,f:3}`.
- **Secondary faithful bug** (independent of membership): `buildSkeletonEdgeCounts`
  bumps `rankleader[r]` per `r`; C bumps a fixed `rl = rankleader[ND_rank(v)]`
  once per iteration (`cluster.c:build_skeleton`). Fixing this alone does not
  render 1767. Re-apply with the membership fix.
- RC2's `mapPathLongSingle` crash is already gone (T2). Don't re-open it.
- See `plans/errored-cluster/batch-2/deferred-1767.md` and `deferred-1332-b53.md`
  for the full per-case evidence.

## Method (per CLAUDE.md "the C is sacred" + project memory)

- Instrument native C (rebuild `gvplugin_dot_layout`, copy to `/tmp/gvplugins`,
  `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot`). **Always revert C
  instrumentation + rebuild before finishing** (oracle must stay clean).
- For each case: dump C's cluster node sets, ranks, and cluster-install order;
  diff against the port's at the same phase. Find the *first* divergence.
- Relevant memory: `2471-blocker-is-cluster-ranking`, `contain-nodes-vstart-window`,
  `map-vs-nlist-iteration-hazard`, `calloc-zero-vs-undefined-port-hazard`,
  `recover-slack-and-c-harness`, `instrument-c-before-quarantine`.

## C reference map

| Concern | C site |
|---------|--------|
| cluster membership / owned nodes | `lib/dotgen/cluster.c:mark_clusters`, `dot.c` working-graph build, `ND_clust` assignment |
| cluster edge set for skeleton | `lib/dotgen/class2.c:class2` (calls `build_skeleton(g, GD_clust(g)[c])`) |
| cluster ranking | `lib/dotgen/rank.c`, `lib/dotgen/cluster.c:build_ranks`/`install_cluster` |
| skeleton | `lib/dotgen/cluster.c:build_skeleton` |

## Deliverables

1. `findings.md` — first-divergence per case, with C vs port dumps.
2. `root-cause.md` — the single (or few) upstream defect(s) + blast radius.
3. `fix-plan.md` — a scoped fix-mission outline (write-sets, batch/task split,
   oracle gates), explicitly stating whether one fix covers all three cases.
4. Recommendation: one fix mission, or per-defect missions.

## Stop conditions

- STOP and report if the membership defect and the ranking defect are
  independent (→ two fix missions) vs one shared cause (→ one).
- Do NOT write production fixes in this mission — investigation only. If a
  one-line faithful fix is irresistible, log it in `fix-plan.md` instead.

## Status — COMPLETE (2026-06-22)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| P1 | [findings.md](findings.md) (per-case first divergence) | [x] |
| P2 | [root-cause.md](root-cause.md) (upstream defect + blast radius) | [x] |
| P3 | [fix-plan.md](fix-plan.md) (scoped fix mission outline) | [x] |

### Outcome

Three defects identified (C ground truth + experiments; port reverted to HEAD,
investigation only):
- **A** membership — `markClusters` omits C's `agdelete(clust,n)` for
  already-claimed nodes → foreign nodes in cluster node sets. **Shared root
  cause** across all 3 cases.
- **B** skeleton count — `buildSkeletonEdgeCounts` `rankleader[r]` vs fixed `rl`.
- **C** single-node leaf clusters never get `info.rank` (1332 only) — narrower
  follow-on, needs one C-instrumentation step.

**A+B validated regression-clean (full suite 2250 pass); together they render
b53 + 1767.** Recommendation: one fix mission `cluster-membership-fix`, Batch 1
= A+B (high confidence, ship first), Batch 2 = C (gated on its own
investigation). Converts 3 deferred errored cases into 2 ready-to-fix + 1 scoped
follow-on.
