# Batch 2 — emission + end-to-end verification (parallel)

T4 wires the two missing live emission sites. T5 verifies all four
label kinds end-to-end against the C binary and ports any dotsplines/
bb gaps it finds (conditional write-set). Disjoint write-sets
(device.ts vs splines/bb modules).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | node-xlabel + graph-label live emission ([T4-emission.md](T4-emission.md)) | sonnet | src/gvc/device.ts (+ test) | T1, T3 | [x] |
| T5 | C-oracle verification + dotsplines/addLabelBB gap-fill ([T5-verify-gaps.md](T5-verify-gaps.md)) | sonnet | CONDITIONAL: src/layout/dot/splines*.ts, bb module; .probes/* | T1, T2, T3 | [x] |

Batch gate runs after BOTH land (T5's verification needs T4's emission
for text-content comparison; T5 may begin with position-level probes
before T4 finishes).
