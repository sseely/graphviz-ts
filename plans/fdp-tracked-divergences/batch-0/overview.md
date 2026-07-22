# Batch 0 — Restore fdp injection, regenerate attribution, re-bucket

The highest-leverage and highest-risk batch: fdp injection is currently broken
(`GVTS_POS_DUMP` emits 0 for `-Kfdp`), so the tracked/accepted split is
unknown. Restore the native dump, regenerate a trustworthy attribution, and
re-bucket. **Output feeds every later batch** (which are provisional until T0.3).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T0.1 | Re-add native fdp `GVTS_POS_DUMP`, rebuild `dot`, verify it fires | debugger | ~/git/graphviz/lib/fdpgen/layout.c (native) | — | [ ] |
| T0.2 | Regenerate `attribution-fdp` + snapshot `parity-fdp` baseline | general-purpose | test/corpus/attribution-fdp.{jsonl,json} | T0.1 | [ ] |
| T0.3 | Re-bucket not-cleared → findings + refined bucket list | general-purpose | batch-0/findings.md | T0.2 | [ ] |

Run T0.1 → T0.2 → T0.3 strictly in sequence. No `src/` changes in this batch
(the only code change is the env-gated native dump line). After T0.3 the
executor knows the real surviving buckets; batches emptied by the fresh
attribution are skipped (log in decision-journal).
