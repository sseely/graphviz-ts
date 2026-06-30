<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: cluster-subsystem — land cluster membership + routing + ranking together

## Type: fix (unified, interdependent)

Created 2026-06-22 after the piecemeal approach proved the cluster fixes are
**interdependent and cannot ship in isolation**. Supersedes the separate
`cluster-membership-fix` Batch 2 split and the two follow-on briefs (now
sub-references).

## Why this is one mission, not several

The membership fix (defect A) is faithful to native C but **load-bearing**: it
corrects cluster node sets for *every* cluster graph, which exposes latent
downstream cluster defects in graphs that previously rendered *despite* wrong
membership. Shipping A alone is a **net regression**:

Parity survey of `cluster-membership-fix` Batch 1 (A+B) vs main baseline:
- ✅ `1767` errored → diverged (fixed)
- ❌ `2825` **diverged → errored** (rendered before, now crashes — defect D)
- ❌ `1221` timeout → errored (defect D2, position)
- ❌ `2721` timeout → errored (defect D2, position)
- net errored **8 → 10**

Therefore membership (A) may only merge once the defects it exposes (D, D2, C)
are also fixed. This mission lands all of them as one coherent change.

## The four defects

| Defect | What | Cases | Status |
|--------|------|-------|--------|
| **A** membership | `markClusters` must `agdelete` already-claimed (foreign) nodes from a cluster's node set | all cluster graphs | **implemented** (branch, commit c923f1a) |
| **B** skeleton count | `buildSkeletonEdgeCounts` fixed `rl=rankleader[ND_rank(v)]` not `rankleader[r]` | 1767 | **implemented** (c923f1a) |
| **C** expansion | `markClusterNode` agdeleted a foreign node from `clust.nodes` but left its incident edge in `clust.edges`; `agContainsEdge` then made `interclexp` skip a crossing edge, orphaning its chain (NOT "leaf clusters never expanded" — that was a symptom) | 1332 | **implemented** — `agDeleteFromCluster` mirrors C `agdelnode`; `plans/cluster-expansion-recursion/` |
| **D** edge routing | mis-scoped: NOT the router. `nodeInduce` missing C node_induce first loop → a sibling-owned node re-ranked by another cluster → ranks collapse → orphan chain vnode → corrupt rank (routing symptom) | b53, 2825 | **implemented** — `pruneForeignClusterNodes`; b53 ranks match C exactly |
| **D2** position | empty-cluster (post-agdelete) clobbers shared root rank via vStart aliasing → null `rank.v[0]` | 1221, 2721 | **implemented** (commit 99e17d3) — `removeEmptyClusters` in dotMincross |

## Branch
`feature/cluster-membership-fix` (already holds A+B). Continue here; **do not
merge until the merge gate passes.**

## Merge gate (hard — ADR-5, 0 regression)
Regenerate `test/corpus/parity.json` + `PARITY.md`. Required:
- `1767`, `1332`, `graphs/b53.gv`, `2825`, `1221`, `2721` all render (not errored).
- **0 per-id regressions** vs the main baseline (byte→worse, structural→worse,
  diverged→errored, render→timeout). oracle-error transitions excluded as noise.
- Full vitest suite green; typecheck 0; build 0.

Until the gate is green, **nothing merges to main** — main stays at errored 8.

## Suggested batch order
1. **D2 (position)** — likely the simplest null-`v[0]` fix; unblocks 1221/2721.
2. **C (expansion)** — `plans/cluster-expansion-recursion/`; unblocks 1332.
3. **D (edge routing)** — `plans/cluster-edge-routing/`; unblocks b53, 2825.
   Largest (faithful router needs cluster support).
After each: full suite; only run the parity gate at the end.

## Architecture decisions
Carry ADR-1 (faithful C port, no guards), ADR-4 (faithful = success even if
`diverged`), ADR-5 (parity regen + 0 regression). C is the spec; instrument
native dot, revert C instrumentation + rebuild before finishing.

## References (start here — don't re-derive)
- `plans/cluster-membership-derisk/findings.md` + `root-cause.md` + `fix-plan.md`
  — A/B/C/D root causes with native-C dumps.
- `plans/cluster-edge-routing/README.md` — defect D detail.
- `plans/cluster-expansion-recursion/README.md` — defect C detail.
- memory `errored-cluster-rc2-rc3-are-membership`.

## Status
| Batch | Defect | Status |
|-------|--------|--------|
| — | A + B (membership + skeleton) | [x] implemented (c923f1a, unmerged) |
| 1 | D2 (position null v[0]) | [x] implemented (99e17d3) — 1221, 2721 render |
| 2 | C (cluster expansion recursion) | [x] implemented (58eed09) — `markClusterNode` agdelete edge cleanup; 1332 renders |
| 3 | D (cluster-aware edge routing) | [x] implemented — `pruneForeignClusterNodes` (node_induce first loop); b53 ranks match C exactly |
| 4 | merge gate (parity 0-regression) + merge | [x] gate GREEN — ready to merge |

### Progress (2026-06-22) — MERGE GATE GREEN
All defects implemented on `feature/cluster-membership-fix`. Parity regenerated:
**errored 8→5, timeout 8→6, conformant 249→251, 0 per-id regressions.** All six
targets render: 1221 + 2721 conformant; 1332, 1767, b53 diverged (ADR-4); 2825
diverged (unchanged). Full vitest suite **2260 pass**, typecheck 0, build 0.
Defect D was mis-scoped as routing — the real cause was a rank-phase membership
gap (`nodeInduce` missing C's foreign-node prune), the same agdelete pattern as
defect C. **Ready to merge to main** (use a merge commit, not squash, per
pr-workflow.md — preserves per-task commit IDs). Awaiting user go-ahead.
