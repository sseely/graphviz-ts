<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: structural-match endgame (24 tracked ids → conformant or accepted)

**Objective.** Drive every remaining tracked structural-match case (canonical
snapshot 56ad33d: conformant 733, tracked 24) to `conformant`, or to a
documented-irreducible acceptance (registry + prose + guard). Decomposed by
mechanism family. "Accepted with C-instrumented evidence" is a legitimate
terminal state (policy D1).

**Branch/merge.** Diagnosis tasks commit their analysis docs directly to main
(docs-only). Each FIX/ACCEPT task gets its own branch, squash-merged to main
after its BATCH's gate passes (D4), pushed, branch deleted.

## Constraints

STOP (pause family, journal, ask the user) when:
1. Fix needs files outside the declared/journal-authorized write-set →
   **ask the user to expand the write-set** (list files + why); other
   families continue.
2. Two consecutive batch-gate failures on the same check.
3. 3 consecutive edits to one locus without closing the same failing check.
4. Diagnosis contradicts decisions.md or a documented accepted-divergence.
5. Native oracle crashes / is nondeterministic on a family graph.
6. Bounded diagnosis pass ends with no mechanism AND no acceptance evidence.
7. (1949) trail leads back to D1/D2 (entity-decode/pen-color) — already fixed.

PUSH FORWARD without asking:
- Diagnosis names a write-set ≤3 files inside the family's subsystem →
  journal-authorize, proceed.
- Acceptance verdict meets the A3/A7 documentation bar → registry+prose+
  guard, proceed.
- Timing-flip verdicts (1652-class) that verify standalone → journal only.
- Family already-closed on re-verify → verdict "already-closed", skip fix.

## Quality gates (per batch)

- command: npx tsc --noEmit -p tsconfig.build.json
  pass: exit 0            on_fail: fix_and_rerun
- command: npx vitest run
  pass: all tests pass    on_fail: fix_and_rerun
- command: GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts
  (MACHINE MUST BE OTHERWISE IDLE — LPT dispatch renders the monsters FIRST;
  no vitest/agents/builds during the survey, especially its first minutes)
  then: npx tsx test/corpus/rules-gate.ts
  pass: gate exit 0, regressions=0 (timing flips verified standalone first)
  on_fail: bisect within batch; stop after 2 consecutive failures
- command: git diff --name-only <branch-base>..HEAD per task
  pass: within declared/authorized write-set
  on_fail: stop → ask user to expand write-set

After a passing batch gate: cp test/corpus/parity-rules.json
test/corpus/parity.json && npx tsx test/corpus/dashboard.ts, commit snapshot.

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — diagnoses ×7 (parallel, worktree, docs-only) | [ ] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — known-locus fixes (decorate, portlabel, 1949) | [ ] | [batch-2/overview.md](batch-2/overview.md) |
| 3 — fixes from Batch-1 verdicts | [ ] | [batch-3/overview.md](batch-3/overview.md) |
| 4 — polypoly outcome + NS diagnosis | [ ] | [batch-4/overview.md](batch-4/overview.md) |
| 5 — NS outcome + closeout | [ ] | [batch-5/overview.md](batch-5/overview.md) |

Links: [decisions.md](decisions.md) · [decision-journal.md](decision-journal.md) ·
[diagrams/component-map.md](diagrams/component-map.md) ·
[diagrams/data-flow.md](diagrams/data-flow.md) · analysis/ (diag outputs land here)

Model routing: per-task `model:` line in each task file (fable = C-instrumentation
/long-horizon; opus = multi-path decisions; sonnet = mechanical). Diagnosis agents
that touch the port tree MUST run with isolation:worktree.
