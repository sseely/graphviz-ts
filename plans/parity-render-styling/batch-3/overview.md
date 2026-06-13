# Batch 3 — goldens (after batch 2, orchestrator inline)

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T6 | Styled goldens + C-oracle verify ([T6-goldens.md](T6-goldens.md)) | orchestrator | test/golden/inputs/*, refs/*, manifest.json, suite.test.ts | T3, T4, T5 | [x] |

Single inline task — mints ~15 colored/styled goldens (the first
positive coverage of the new behavior) after the per-object styling
lands, then runs final gates on the full feature branch.
