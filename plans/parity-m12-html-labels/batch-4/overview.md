# Batch 4 — verification + goldens (after batch 3, sequenced)

T9 verifies all 7 slots + feature cases against the C oracle and
gap-fills within its conditional write-set; T10 mints goldens from
T9's PASS verdicts. T10 runs only after T9 reports.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T9 | C-oracle verify + gap-fill ([T9-verify.md](T9-verify.md)) | sonnet | CONDITIONAL: blast-radius files only; .probes/* | T4–T8 | [ ] |
| T10 | Goldens 72→82 ([T10-goldens.md](T10-goldens.md)) | orchestrator inline | test/golden/* | T9 | [ ] |
