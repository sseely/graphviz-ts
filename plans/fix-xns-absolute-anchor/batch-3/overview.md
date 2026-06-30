# Batch 3 — Validate + refresh baseline

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T7 | Full survey + gate; refresh baseline | orchestrator | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md` | Batch 2 | [x] |

**T7 result:** fresh survey (committed Batch-2 code) → GATE PASS, 0 regressions,
0 clip-regressions vs the prior baseline. Promoted parity-rules.json → parity.json
+ regenerated PARITY.md. conformant 492 / structural 198 / diverged 89 /
oracle-error 11 (verdict counts UNCHANGED — Batch 1+2 are 0-verdict-delta). The
refresh records the maxΔ detail shifts on 13 diverged graphs (2368
childCount→coord, maxΔ 5→65.25; b29 family up; b124/arrowsize/biglabel down).
**Targets NOT fully conformant**: 2368 stays diverged (separate flat-ranksep +
labeled-flat-channel-geometry residual, user-accepted as a follow-up). 2368_1 +
1624 conformant (mission's degenerate-label core).
