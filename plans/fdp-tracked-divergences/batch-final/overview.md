# Batch final — Finalize

Depends on Batches 1-3. Sole writer of the accept-registry and the parity
artifacts (avoids multi-batch write conflicts).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| TF.1 | Consolidate registry, regen docs, full sweep | general-purpose | accept registry, test/corpus/parity-*.{json,jsonl}, PARITY*.md, attribution-fdp.jsonl, decision-journal | 1-3 | [x] |

Single task — runs after every bucket has produced its findings.md.
