# Batch 3 — striped/wedged fills + goldens

**Sequential: T5 first (if in scope), then T6 (orchestrator inline).**
Both depend on batch 2 being complete and committed.

T5 ports `stripedBox` and `wedgedEllipse` from emit.c — the
multi-stripe / wedge-segment fill variants that use the same
`parseSegs` color-list infrastructure as gradients. T6 is the
golden-harvest task run inline by the orchestrator.

If Scott decides to defer T5 to a follow-on mission (see decisions.md
open question 1), skip T5 and proceed directly to T6 after batch 2.

## Task table

| ID | Name | Write-set | Depends on |
|----|------|-----------|------------|
| T5 | [striped + wedged multicolor fills](T5-striped-wedged.md) | src/render/svg-striped.ts (new), src/common/style-resolve.ts | batch 2 |
| T6 | [goldens + C-oracle verify](T6-goldens.md) (orchestrator inline) | test/golden/inputs/, test/golden/refs/, manifest | T5 (or batch 2 if T5 deferred) |
