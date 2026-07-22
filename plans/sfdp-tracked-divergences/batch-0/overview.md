# Batch 0 — Root-cause the majority

Regenerate the sfdp attribution over the current diverged set, then re-bucket
the surviving not-cleared ids. This is the highest-leverage step: the stale
attribution is why 50 look tracked; a fresh run reclassifies the majority and
resolves the 3 pgram harness-errors. **Output feeds every later batch.**

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T0.1 | Regenerate `attribution-sfdp.jsonl` over current 234 diverged | general-purpose | test/corpus/attribution-sfdp.jsonl | — | [x] |
| T0.2 | Re-bucket not-cleared → findings + refined bucket list | general-purpose | batch-0/findings.md | T0.1 | [x] |

Run T0.1 then T0.2 (T0.2 consumes T0.1's output). No `src/` changes in this
batch — analysis only. After T0.2, the executor knows the real surviving
buckets; batches whose representative was reclassified drift-exonerated are
skipped (log in decision-journal).
