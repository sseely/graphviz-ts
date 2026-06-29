<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: x-coord NS Tree_edge list-order fidelity

## Objective
Make the port's x-coordinate network-simplex `Tree_edge` list order match C's, so
`LR_balance` applies its degenerate-rerank sequence in lockstep with C and selects
C's optimal vertex. Fixes share-b51 (node `blok_60` 158px off) and is the minimal
probe for the broader 2371 x-NS mass-divergence class.

## Root cause (already pinned — do NOT re-derive)
Full evidence: `.agent-notes/b51-blok60-is-xcoord-ns-selection.md`. Summary:
- blok_60's x is **degenerate** (cost 499 for any x in [329,828]); C picks 611,
  port picks 453 — both optimal, different vertex.
- Feasible tree, base optimum, and blok_60's tree position (low=lim=549) are
  IDENTICAL C vs port. The whole divergence is in `LR_balance`.
- `LR_balance` walks `Tree_edge[i]` in order. **First rerank (i=48) already
  diverges**: C's `Tree_edge[48]` = edge(lim 516→514), port's = edge(lim 459→442).
  → the **Tree_edge LIST ORDER differs**, built by `feasibleTree`'s subtree-merge
  (`addTreeEdge` call order) — the modern subtree-heap `tight_tree`.

## Branch
- Work branch: `feature/fix-xns-tree-order` (merge-commit to main; per-task commits).
- Created at execution start; do not pre-create.

## Quality gates
- `npx tsc --noEmit` → exit 0 (after every code change).
- `npx vitest run src/layout/dot/ns-subtree.test.ts src/layout/dot/ns-range.test.ts src/layout/dot/position.test.ts src/layout/dot/position-aux.test.ts` → all pass. `ns-subtree.test.ts` exists (baseline: STset union-find + subtree min-heap, the primitives the fix must NOT change); T1 extends it with an order-locking assertion.
- **Integration gate (Batch 2):** full headless parity survey, **0 regressions** vs
  `test/corpus/parity.json` (baseline byte-match=522). Recipe in `batch-2/T2-survey-gate.md`.
- Minimal repro: `~/git/graphviz/tests/share/b51.gv`, node `blok_60` → target
  x-center **611.38** (NS rank 463).

## Batches (sequential — each needs the prior)
- [ ] **Batch 0** — Diagnose exact add-order divergence → `batch-0/overview.md`
- [ ] **Batch 1** — Implement order fix + verify blok_60 → `batch-1/overview.md`
- [ ] **Batch 2** — Survey gate + baseline refresh → `batch-2/overview.md`

## Constraints
**Stop conditions:**
- ANY survey regression → stop, do not merge.
- blok_60 ≠ 611.38 after matching add-order → diagnosis incomplete (look deeper:
  `dfsRange` lim numbering or `createAuxEdges`) → stop, reassess.
- Fix needs files outside `ns-subtree.ts` / `ns-core.ts` / `ns-range.ts` → stop.
- 3 consecutive failed attempts on the same locus → stop (architectural).

**Push-forward:** XNSDBG instrumentation freely; small tie-break fixes within the
NS files that demonstrably match C's order.

## Docs
- Decisions: `decisions.md`
- NS call-chain diagram: `diagrams/component-map.md`
- Decision journal: `decision-journal.md`
