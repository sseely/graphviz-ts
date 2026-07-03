<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 5 — synthesize the ranked candidate-mission list

Merge the per-bucket diagnoses into one analysis index and rank equivalence
classes as prioritized fix missions.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T5 | Synthesize `analysis/README.md` from all `bucket-*.md` | (orchestrator, direct) | `plans/structural-match-buckets/analysis/README.md` | T4 (all) | [x] |

Direct synthesis — it reads every `bucket-*.md` summary table and produces the
cross-bucket ranking; no fan-out.
