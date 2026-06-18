# Architecture Decisions — mincross-clust-c-parity

## AD-1: localize-then-fix within the pre-authorized 4-file set

**Context:** A "stuck crossing" bug can't be pinned to one file before
diagnosis; the swap-blocking site may be in transpose, reorder/medians,
build_ranks, or the cluster orchestration.

**Decision:** Task 1 localizes with `mc3` + a probe; the fix (Task 2) may touch
any of `mincross-cross.ts`, `mincross-order.ts`, `mincross-build.ts`,
`mincross.ts` + tests. Log the localization in the journal before editing.

**Consequences:** Bounded candidate set; no mid-stream re-confirmation needed.

## AD-2: regenerate churned cluster goldens from the C oracle

**Context:** Removing crossings changes multi-cluster rendered output toward C.

**Decision:** Regenerate churned goldens from the native C binary; record test
name + old/new crossing count + C-match confirmation. STOP if TS ≠ C after fix.
Never hand-edit. (Corpus may contain no triggering case — measure.)

**Consequences:** A churn toward C is correct behavior.

## AD-3: success predicate is per-rank node-ORDER match, not crossing count

**Context:** This is a swap-legality bug. Two different orderings can reach the
same crossing count; a fix could match C's count via a different order than C,
and count-parity would not catch it. The downstream x-coord and spline passes
consume the order vector, so a silent order divergence corrupts them later —
far costlier to trace from 2471 than to catch here on a tiny reproducer.

**Decision:** Success = cluster reproducers match **C's per-rank node order**
(L-to-R sequence per rank, real nodes by name, virtuals as placeholders), not
merely C's crossing count. The C order vector is already instrumentable.

**Consequences:** Closes the "right number, wrong arrangement" gap. Costs
nothing not already instrumented (reproducers are small).

## AD-4: 2471 re-tested but full render not guaranteed

**Context:** 2471 is a layered onion (rank → mincross → x-coord → splines).

**Decision:** Re-test 2471 after the fix. If it renders, great; if it surfaces
a further divergence (predicted: x-coord under clusters) or the mincross perf
gap, record that as the next mission — not this mission's failure.

**Consequences:** Bounds the mission to the crossing-minimization layer.

## AD-5: rollback

Reversible — revert the merge. Internal ordering state + regenerated goldens
only. Cluster-free and crossing-free cluster graphs unaffected.
