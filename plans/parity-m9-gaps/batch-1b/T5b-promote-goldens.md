# T5b — promote dot-minlen + twopi-self-loop

## Context

Executed inline by the orchestrator after T3b and T1b both report
PASS (per the batch-1 T5 precedent, journaled). AD5 governs.

## Task

For each golden reported PASS by T3b/T1b: `git mv` quarantine
input/ref into test/golden/inputs|refs/, APPEND a manifest entry
(engine tolerance class; description with content summary + "ref:
graphviz 15.0.0 dot -K<engine> -Tsvg; promoted from quarantine
(mission 9, post-parity T2 mining)"), update the suite.test.ts count
assertion (comment AND test name AND expect value). Run the full
suite; a promoted golden failing despite the task report → STOP per
AD5. A FAIL report → leave quarantined, journal, surface as stop
signal.

## Write-set

test/golden/manifest.json (append only), test/golden/suite.test.ts
(count only), test/golden/inputs/*, test/golden/refs/*,
test/golden/quarantine/* (moves out)

## Acceptance criteria

- Both promotions land: manifest 60 → 62, quarantine down to the 4
  batch-2/3 goldens (dot-rankdir-lr, dot-rankdir-bt, dot-multi-edge,
  dot-head-tail-label)
- Existing manifest entries byte-unchanged; suite green with updated
  count

## Quality bar

npx tsc --noEmit clean; npx vitest run green. Commit:
`test(T5b): promote dot-minlen and twopi-self-loop from quarantine`
