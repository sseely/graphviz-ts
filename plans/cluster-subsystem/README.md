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
| **D** edge routing | faithful edge router has no cluster support; intra-cluster chain vnode gets corrupt rank (-183) | b53, 2825 | not started — `plans/cluster-edge-routing/` |
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
| 2 | C (cluster expansion recursion) | [x] implemented — `markClusterNode` agdelete edge cleanup; 1332 renders |
| 3 | D (cluster-aware edge routing) | [ ] |
| 4 | merge gate (parity 0-regression) + merge | [ ] |

### Progress (2026-06-22)
A+B + D2 implemented on `feature/cluster-membership-fix`. Renders now: 1767
(A+B), 1221 + 2721 (D2). Remaining for merge: C (1332), D (b53, 2825). Full
vitest suite 2258 pass. Parity gate deferred to the end (after C + D) — do not
run/merge until all six target graphs render.
