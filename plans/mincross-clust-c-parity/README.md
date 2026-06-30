# Mission: mincross-clust C-parity

## Objective

Fix the cluster-aware mincross crossing-minimization divergence that now blocks
`tests/2471.dot`. After the cluster-ranking fix (rank structure now == C), the
root mincross on a clustered graph fails to remove crossings that C removes:
on the minimal repro `mc3` (3 clusters, long inter-cluster edges) both C and TS
**start at cur_cross 1**, but C reaches **0** in one `mincross_step` while TS
**holds at 1 forever**. Same starting order → this is a swap-*legality* defect
in the cluster-constrained transpose/reorder, not init-order and not a missing
phase (TS `dotMincross` already mirrors C's components→merge2→clust→remincross).

## Success predicate (AD-3 — order, not count)

Success = cluster reproducers match **C's per-rank node order** (the L-to-R
sequence per rank), NOT merely C's crossing count. A scalar count can match
while the order vector diverges — the classic mincross trap (ncross matched
while order didn't is what bit the rank layer). Order divergence here would
silently corrupt the downstream x-coord/spline consumers. The C order vector is
already instrumentable and reproducers are tiny, so per-rank order diff is cheap.

## Onion context

Pipeline layers peeled in order: **rank → mincross** (this). If 2471 surfaces a
further divergence after this fix, the predicted next layer is **x-coordinate
assignment under cluster constraints** (priority/median positioning), ahead of
spline routing. Descending the pipeline in order is the signal each fix is
genuinely final, not masking.

## Branch / merge

- Branch: `feature/mincross-clust-c-parity` (off `main`).
- Merge to `main` with a **merge commit**.

## Constraints

**STOP when:** fix needs files outside the 4-file set (`mincross-cross.ts`,
`mincross-order.ts`, `mincross-build.ts`, `mincross.ts`) + tests; a reproducer
matches C's crossing COUNT but per-rank ORDER still diverges (not done); the
same swap-legality site changed 3× without mc3 reaching C's order; a regenerated
golden's TS ≠ C; cluster-free/crossing-free output changes; 2 consecutive gate
failures.

**PUSH FORWARD when:** localization lands anywhere in the 4-file set (AD-1); a
cluster golden churns and new TS == C conformant (AD-2); 2471 reaches correct
mincross order but still doesn't render — record next divergence (predicted
x-coord) as follow-up, not failure (AD-3).

## Quality gates

- `npx tsc --noEmit` → 0
- `npx vitest run` → all pass; churned goldens regenerated from C oracle, TS==C
- Hook limits: 30 lines/fn, CCN 10, 5 params, 500/file
- `git diff --name-only` ⊆ write-set + regenerated goldens

## Baseline (2026-06-17, main): tsc 0, vitest 1869.

## Batches

| Batch | Focus | Status |
|-------|-------|--------|
| 1 | Localize swap-blocking site (T1) + fix with TDD (T2) | [x] |
| 2 | Regenerate cluster goldens from oracle (T3); per-rank order verify + 2471 re-test (T4) | [x] |

## Mission summary (2026-06-17)

**Complete.** Root cause was NOT the brief's prime suspect (left2right transpose
guard) alone — C↔TS order probes showed the crossing-removing move is a
reverse-tie **reorder** swap, gated by TWO independent over-restrictions, both in
the write-set: (1) `mediansProcessNode` skipped `mval` for every clustered node
(absent from C), leaving cluster skeletons out of reorder; (2) `left2right` was a
stale `agContainsNode` port. Fixed both; mc3 1→0 with order == C.

- Tasks: 4/4 (T1–T4). Decisions logged: 4 (1 flagged — prime suspect refined).
- Gates: `tsc` 0; vitest 1869→**1873** (4 TDD regressions, each verified
  red→green); **zero golden churn**; write-set ⊆ {mincross-cross, mincross-order,
  mincross}.ts + their tests.
- AD-3 met: per-rank order **conformant TS==C** (mc3, 6-cluster chain).
- Follow-up (AD-4, not a failure): 2471 still hangs in the **pre-existing**
  mincross transpose perf gap (HEAD~1 profiles identically, 97.6% transposeStep).
  Next mission: mincross transpose performance, then x-coord under clusters.

## Harness

C: `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -v FILE`
(`mincross:`/`Maxrank=` lines). TS: `setMincrossTrace` hook (committed) via a
/tmp esbuild entry. Minimal stuck repro `mc3` below. Per-rank order dump: add a
temporary order probe to both sides (real nodes by name, virtuals as `_v`),
diff per rank; revert after. See memory `2471-blocker-is-cluster-ranking`.

```
digraph { node [shape=rectangle];
  subgraph cluster_0 { a0;a1;a2;a3; a0->a1; a1->a2; a2->a3; }
  subgraph cluster_1 { b0;b1;b2;b3; b0->b1; b1->b2; b2->b3; }
  subgraph cluster_2 { c0;c1;c2;c3; c0->c1; c1->c2; c2->c3; }
  a3->b0; a0->b3; b3->c0; b0->c3;
}
```
C: 1→0. TS: stuck at 1.

## Index

- [decisions.md](decisions.md)
- [batch-1/overview.md](batch-1/overview.md) · [batch-2/overview.md](batch-2/overview.md)
- [diagrams/component-map.md](diagrams/component-map.md) · [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)
