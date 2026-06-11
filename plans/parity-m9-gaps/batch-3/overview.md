# Batch 3 — head/tail labels, final promotion, mission close

T9 first; T10 after T9.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T9 | headlabel/taillabel implementation ([T9-head-tail-labels.md](T9-head-tail-labels.md)) | sonnet | src/common/edge-label-init.ts (new), src/layout/dot/init.ts, src/layout/dot/splines-label.ts, src/model/edgeInfo.ts, src/common/edge-label-init.test.ts (new) | — | [ ] |
| T10 | promote final golden + mission close ([T10-promote-close.md](T10-promote-close.md)) | sonnet | test/golden/*, plans/parity-m9-gaps/* | T9 | [ ] |

Write-set conflict check: init.ts free again (T1 batch 1, T6 batch 2
are done); no overlaps within the batch (sequential anyway).
