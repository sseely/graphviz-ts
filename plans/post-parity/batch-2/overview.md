# Batch 2 — Gate wiring + demos

Runs after batch 1 (T4 reads T2's manifest count change; T5 edits
package.json after T1's edit lands). T4 and T5 are parallel with each
other — disjoint write-sets except neither touches the other's files.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | gates.sh coverage gate + stale Gate 3 fix ([T4-gates-rework.md](T4-gates-rework.md)) | sonnet | test/golden/gates.sh, test/golden/run.sh | T1, T2 | [ ] |
| T5 | demos folder, live in-browser side-by-side ([T5-demos.md](T5-demos.md)) | sonnet | demos/*, package.json (scripts only) | T1, T2 | [ ] |

After batch 2: **MANDATORY CHECKPOINT** — stop, present
plans/post-parity/coverage-baseline.md to Scott, wait for his batch-3
scope decision. Do not define batch-3 tasks before that.
