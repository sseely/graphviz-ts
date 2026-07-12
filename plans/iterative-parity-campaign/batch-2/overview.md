# Batch 2 — Per-Engine Attribution Surveys

Runs T1's harness (batch-1) across all three engines' full diverged
sets and produces the bucket analysis that drives batch-3's rounds.

## Tasks

| Task | Subject | Diverged count (2026-07-11 sweep) |
|---|---|---|
| T4 | neato attribution + bucket analysis | 492 |
| T5 | fdp attribution + bucket analysis | 435 |
| T6 | sfdp attribution + bucket analysis | 494 |

Each writes disjoint files (`attribution-<engine>.json` + its own
`<engine>-buckets.md`) — run all three in parallel once batch-1 is
merged.

## Exit criteria

- 100% of each engine's diverged ids carry a verdict in
  `attribution-<engine>.json` (no id left unattributed).
- Each engine has a `batch-2/<engine>-buckets.md` ranking buckets by
  member count, largest first — this is what batch-3 round selection
  reads.
- fdp's analysis explicitly checks whether any bucket maps to the known
  unported `clusteredges.c` gap (compound cluster-edge routing —
  `plans/port-catalog/README.md:358`) and flags it if so, since that's
  the standing lead for fdp's tail.
