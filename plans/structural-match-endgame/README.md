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
| 1 — diagnoses ×7 (parallel, worktree, docs-only) | [x] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — known-locus fixes (decorate, portlabel, 1949) | [x] | [batch-2/overview.md](batch-2/overview.md) |
| 3 — fixes from Batch-1 verdicts | [x] | [batch-3/overview.md](batch-3/overview.md) |
| 4 — polypoly outcome + NS diagnosis | [x] (T14 pulled to b3; T18 done) | [batch-4/overview.md](batch-4/overview.md) |
| 5 — NS outcome + closeout | [x] (T19 a522206; T20 this commit) | [batch-5/overview.md](batch-5/overview.md) |

Links: [decisions.md](decisions.md) · [decision-journal.md](decision-journal.md) ·
[diagrams/component-map.md](diagrams/component-map.md) ·
[diagrams/data-flow.md](diagrams/data-flow.md) · analysis/ (diag outputs land here)

Model routing: per-task `model:` line in each task file (fable = C-instrumentation
/long-horizon; opus = multi-path decisions; sonnet = mechanical). Diagnosis agents
that touch the port tree MUST run with isolation:worktree.

## Mission summary (2026-07-05, T20)

Input: 24 tracked structural-match ids (snapshot 56ad33d, conformant 733).
Outcome: **conformant 733 → 749 (+16)**; tracked non-accepted ids 24 → 5.

- FIXED (18 ids): b29 x4 + b124 x3 (swapBezier size-bounded reverse, T11);
  2361 + 1856 (ortho int-trunc relax + compass-port endpoints, T13);
  polypoly x3 (base-box plumb, T14); 2613 (xlabel flip swap, T15);
  144_ortho + graphs-arrowsize (bezier-size read + ortho placePortLabels, T9);
  2521 (mincross save_best window-relative scratch, T19); 1949 canvas class
  (flat-adj normalize predicate, T10b — residuals remain, see below).
- ACCEPTED with C-instrumented evidence (3 ids -> A3 registry): 2413_1,
  2413_2, graphs-decorate (findMaxDev hypot symmetric-ties <= 5.7e-13).
- STILL OPEN, re-attributed with fresh evidence (5 ids): 1949 (labeled-flat
  text-y family Δ5.43 + aux HTML sizing), 1453 (TREE_GROUP placement Δ457),
  2646 (unknown; T7's corridor-bounds theory landed as a faithful fix but its
  causal link was refuted), 2371 (2-edge spline-shape residual Δ16.8 — NOT
  NS; stale memory corrected), 1447_1 (ortho maze-corridor 2620-family Δ~151,
  improved from 781 by T3/T13).
- Retired hypotheses: ortho equal-cost tie-break (both real bugs), polypoly
  float noise (plumbing bug), xcoord-NS solution selection (class EMPTY — NS
  byte-identical; the one member was a mincross scratch bug).
- Harness fixes shipped en route: oracle cap scales with slowest native;
  LPT dispatch; canonical native timing for 1652.
- Every fix C-faithful, TDD'd, zero corpus regressions across five gates
  (1652/2646 maxΔ=0.0 load-flips standalone-verified per protocol).
