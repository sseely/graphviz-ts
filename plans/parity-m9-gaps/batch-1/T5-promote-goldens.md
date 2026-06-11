# T5 — promote batch-1 goldens

## Context

T1–T3 reported PASS for up to 5 quarantined goldens: dot-minlen,
dot-constraint-false (T1), dot-self-loop (T2), twopi-self-loop,
circo-self-loop (T3). Promotion is isolated here so test/golden/ has
exactly one writer in the batch. AD5 governs.

## Task

For each golden the T1–T3 reports marked PASS:

1. `git mv test/golden/quarantine/X.dot test/golden/inputs/X.dot` and
   `git mv test/golden/quarantine/X.svg test/golden/refs/X.svg`.
2. APPEND a manifest.json entry matching the existing entry shape;
   description: "ref: graphviz 15.0.0 dot -K<engine> -Tsvg; promoted
   from quarantine (mission 9, post-parity T2 mining)". Tolerance class
   per engine, same as comparable existing entries. If an iterative
   engine needs a pin, use the tolerance+portReference pattern
   (journal entry).
3. Update the suite.test.ts count assertion (comment AND test name AND
   expect value — all three).
4. Run the full suite; every promoted golden must pass. If one fails
   despite the task report: STOP per AD5 (no silent re-quarantine).

If a T1–T3 report marked a golden FAIL, leave it quarantined and
journal it (this is itself a mission stop signal — surface it).

## Write-set

test/golden/manifest.json (append only), test/golden/suite.test.ts
(count only), test/golden/inputs/* (moves in), test/golden/refs/*
(moves in), test/golden/quarantine/* (moves out)

## Read-set

T1–T3 final reports (provided in your prompt by the orchestrator);
test/golden/manifest.json entry shape; AD5 in decisions.md

## Acceptance criteria

- Given 5 PASS reports, when promotion completes, then manifest length
  = 62, quarantine contains only the 4 batch-2/3 goldens, and
  `npx vitest run` is green with the count assertion updated
- Given any promoted entry, then its description records provenance
- Given existing manifest entries, then they are byte-unchanged

## Observability: N/A. Rollback: Reversible.

## Quality bar

npx tsc --noEmit clean; npx vitest run green. Commit:
`test(T5): promote 5 batch-1 goldens from quarantine`
