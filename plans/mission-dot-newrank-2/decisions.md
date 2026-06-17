# Architecture Decisions — DOT-newrank-2

## AD-1: Faithful-first — fix #2 from a written C trace, not a mark-guard

**Context:** The hang (`c` double-installed in root rank 1) could be silenced
with a `mark`/dedup guard in `installInRank`, but that risks masking the real
divergence and producing wrong (non-oracle) layout.
**Decision:** Batch 1 produces `docs/newrank-c-trace.md` — a line-cited trace of
how C routes a cluster node that is ALSO in a cross-cluster `rank=same` set
(`collapse_rankset` / `class2` / `decompose` / `build_ranks` / `install_cluster`
/ `cluster_leader`). Batch 2's fix restores the specific C behaviour the TS port
dropped, cited line-by-line.
**Consequences:** Slower than a patch, but correct and faithful (the C source is
sacred). The trace is a durable artifact and de-risks the fix.

## AD-2: 122 goldens stay byte-identical

**Context:** newrank/cluster-rank=same cases are attr-gated; the 122 existing
goldens are default-attr.
**Decision:** Land a change ONLY if all 122 goldens stay byte-identical. Never
regenerate or quarantine an existing golden.
**Consequences:** Zero golden churn; the dispatch fix must not alter any
non-newrank graph (verified empirically — newrank is read only via the attr).

## AD-3: Bounded scope — allowed write-set + 3-fix cap

**Context:** Reaching oracle parity may need a short chain of fixes in the
ranking/cluster code; depth is uncertain.
**Decision:** Allowed write-set for logic fixes:
`{rank.ts, rank-dot2.ts, mincross-build.ts (+ split modules), mincross-order.ts,
mincross-utils.ts, cluster.ts, classify.ts, decomp.ts}` plus tests and the trace
doc. STOP and rescope if parity needs changes outside this set OR more than 3
distinct logic fixes beyond the dispatch fix.
**Consequences:** Keeps the mission bounded; worst case the residual is
re-scoped with the C trace as the artifact (as the prior mission did).

## AD-4: Split mincross-build.ts (<500 lines) before editing it

**Context:** `mincross-build.ts` is 529 lines, over the check-complexity.py hook
cap (500). Any in-session edit is blocked until split.
**Decision:** Batch 0 splits it into cohesive modules (e.g. extract the
flat-edge cycle-breaking/reorder group, or the fillRanks group, into
`mincross-flat.ts` / `mincross-fill.ts`), preserving all exports and behaviour,
goldens byte-identical, before any logic change.
**Consequences:** Unblocks in-session edits; pure mechanical refactor with zero
output change. Re-exports keep import sites stable.
