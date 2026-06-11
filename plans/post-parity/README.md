# Project: Post-Parity Enhancements

**Objective:** Three additive enhancements now that the test-parity project
is complete (suite 1027/0): (1) a `demos/` folder rendering side-by-side
C-graphviz SVG (stored refs) vs live in-browser graphviz-ts SVG; (2) new
tests mined from mission gap-analyses, guarded-unported paths, and golden
coverage gaps; (3) coverage measurement now, a 90/90/90 check-in gate after
a human checkpoint.

## Branch

`feature/post-parity` off `feature/ts-port`. Merge back with a **merge
commit** when all gates pass.

## Canonical rules

- The C source at `~/git/graphviz/lib/` (tag 15.0.0) remains the spec for
  any behavior question. Refs come from the installed C graphviz 15.0.0
  binary only.
- NEVER modify the existing 50 refs, existing manifest entries, or
  `TOLERANCES` in compare.ts. New entries follow [decisions.md](decisions.md).
- One commit per task; re-read this README + decision-journal.md after
  every compaction (per ~/.claude/rules/autonomous-execution.md).

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND passed count >= 1027 AND failed == 0
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1
  pass: output within the task's declared write-set
  on_fail: stop
```

Baseline at project start: **1027 passed / 0 failed** (2026-06-11,
feature/ts-port after mission-8 merge).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 (parallel) | [T1 coverage baseline](batch-1/T1-coverage-baseline.md), [T2 new goldens](batch-1/T2-new-goldens.md), [T3 guard tests](batch-1/T3-guard-tests.md) | [ ] |
| 2 (after 1) | [T4 gates rework](batch-2/T4-gates-rework.md), [T5 demos](batch-2/T5-demos.md) | [ ] |
| CHECKPOINT | STOP: present coverage-baseline.md to Scott; he sizes batch 3 | [ ] |
| 3 (defined at checkpoint) | [placeholder](batch-3/overview.md) | [ ] |

## Stop conditions

- Change needed outside the task write-set
- 2 consecutive gate failures on the same check
- MANDATORY checkpoint after batch 2: do not define or start batch 3
  without Scott's input on coverage scope
- More than half of T2's new goldens fail against the port (systemic
  layout gap, not test-mining — needs a parity mission, not this one)
- Any temptation to modify existing refs, manifest entries, or tolerances

## Push-forward conditions

- Quarantining an individual failing new golden (journal entry; report
  at mission end)
- New-golden tolerance pinning via the established `tolerance` +
  `portReference` pattern (journal entry)
- Demo styling/layout choices; exact .dot corpus selection within the
  task's candidate list
- Small script fixes inside run.sh / gates.sh

## Key references

- [decisions.md](decisions.md) — D1–D5
- [decision-journal.md](decision-journal.md) — append-only execution log
- [diagrams/component-map.md](diagrams/component-map.md)
- ../test-parity/decision-journal.md — prior project's full history
  (libm-chaos context for iterative engines: entries M8/T3, M8/T-final)
- Debugging hangs: .agent-notes/cluster-hang-2026-06.md (esbuild bundle +
  node --prof; never guard-bisect)
