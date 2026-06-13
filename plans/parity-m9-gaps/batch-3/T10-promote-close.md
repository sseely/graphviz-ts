# T10 — promote final golden + mission close

## Context

T9 reported dot-head-tail-label PASS. This is the last task: after it,
the quarantine directory must be EMPTY and the manifest at 67.

## Task

1. Promote dot-head-tail-label per AD5 (git mv; append manifest entry
   with provenance description; suite.test.ts count → 67).
2. Verify test/golden/quarantine/ is empty; remove the empty directory.
3. Run full gates (tsc, vitest).
4. Mission close bookkeeping (orchestrator may do this part itself):
   mark all checkboxes in plans/parity-m9-gaps/, write the session
   summary at the bottom of README.md (tasks completed, decisions
   count, gate results, follow-ups), final journal entry.

## Write-set

test/golden/manifest.json (append only), test/golden/suite.test.ts
(count only), test/golden/inputs/*, test/golden/refs/*,
test/golden/quarantine/ (emptied + removed),
plans/parity-m9-gaps/README.md, plans/parity-m9-gaps/
decision-journal.md, plans/parity-m9-gaps/batch-3/overview.md

## Read-set

T9 final report; AD5; manifest entry shape

## Acceptance criteria

- Given promotion, then manifest length = 67, quarantine gone, suite
  green at the final count
- Given the mission summary, then it lists per-cluster outcomes and
  any pins/journal flags for Scott's review

## Observability: N/A. Rollback: Reversible.

## Quality bar

npx tsc --noEmit clean; npx vitest run green. Commit:
`test(T10): promote final golden — quarantine empty, mission close`
