# Architecture Decisions — cluster-rank-c-parity

## AD-1: scope boundary includes the dot1Rank(subg) call chain

**Context:** Root cause is `dot1Rank(subg)` returning all-zero local ranks; the
actual missing piece may live in `class1(subg)`, `decompose`, or component
setup — all called from `dot1Rank`.

**Decision:** Pre-authorize `classify.ts` and `cluster.ts` as in-scope for this
one logical fix (same recursive call chain). Log the reason in the journal if
either is touched. One writer per file still holds.

**Consequences:** Avoids stalling on a re-confirmation for what is one faithful-
port defect. Write-set stays small.

## AD-2: regenerate churned clustered goldens from the C oracle

**Context:** Fixing the ranking changes rendered output for multi-cluster
graphs; their goldens currently encode the buggy (overlapping) layout.

**Decision:** Auto-regenerate churned goldens from the **native C binary**. For
each, record in the journal: test name, old vs new `nranks`, and confirmation
new TS output == C byte-for-byte. STOP only if TS ≠ C after the fix.

**Consequences:** A churn that matches C is correct behavior (the C binary is
ground truth). Mirrors the prior mission's AD-3. Never hand-edit a golden.

## AD-3: verification target is rank-structure parity, not 2471 full render

**Context:** 2471 also hits a separate, already-identified mincross performance
gap.

**Decision:** Success = 2471 root mincross-entry STATS matches C (23 ranks /
3213 vnodes) AND clustered goldens match C. Whether 2471 fully renders is OUT
of scope (the perf gap is distinct, deferred work).

**Consequences:** Bounds the mission to cluster-ranking correctness. The perf
gap remains a future mission.

## AD-4: rollback

Reversible — revert the merge. No data/schema/API change. Regenerated goldens
revert with the commit. Cluster-free and single-cluster graphs are unaffected.
