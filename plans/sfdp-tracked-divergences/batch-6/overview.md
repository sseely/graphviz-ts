# Batch 6 — Finalize

Depends on Batches 1-5. Sole writer of the accept-registry and the parity
artifacts (avoids multi-batch write conflicts).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T6.1 | Consolidate registry, regen docs, full cross-engine sweep | general-purpose | accept registry, test/corpus/parity-*.{json,jsonl}, PARITY*.md, attribution-sfdp.jsonl, decision-journal | T1-T5 | [x] |

Single task — it must run after every bucket has produced its findings.md.
