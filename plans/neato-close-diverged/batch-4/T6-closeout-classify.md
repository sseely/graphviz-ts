<!-- SPDX-License-Identifier: EPL-2.0 -->

# T6 · Closeout — final sweep, classify all, document

## Context

T3/T4/T5 ran in isolated worktrees against the post-T1 base. After merging all
three to the mission branch, a combined sweep is required — a fix that passed in
isolation can interact with another (e.g. two edits to shared bbox code). This
task produces the final, authoritative state and the accept-class docs the
project Quality Bar requires ("a mission/batch with any quarantined or excluded
case is not complete until its comparison page exists and is referenced in the
decision journal").

## Task

1. Confirm T3, T4, T5 are merged and their bases were the T2 commit
   (`git merge-base --is-ancestor` — per the "verify an agent's BASE" lesson).
2. Run the **full broad gate** on the merged branch:
   - `bash test/golden/gates.sh`
   - fresh neato sweep → `parity-neato.json`
   - `circo twopi osage patchwork` sweeps + `npm run survey` (dot)
3. Build the final per-id verdict table across the original 95: each is
   `pass` / `fix-landed` / `accept-drift` / `oracle-bug` / `cascade-of-known-parent`.
   0 of the 95 may remain unclassified. The 7 oracle-error ids stay excluded.
4. For every `accept-drift` / `oracle-bug` item: add a `docs/known-divergences.md`
   entry (mechanism + evidence) and, where the project convention requires,
   a comparison page; reference each from `decision-journal.md`.
5. Confirm **0 net regressions** vs the pre-mission baseline (pass ≥ 660 across
   all engines, BY ID).
6. Write the mission summary at the bottom of `decision-journal.md`: tasks done,
   root causes per bucket, final counts, accept-class list, any follow-ups.

## Write-set

- `test/corpus/parity-neato.json` (final regenerated)
- `docs/known-divergences.md`
- `plans/neato-close-diverged/decision-journal.md`
- comparison pages for any accept/quarantine case (project-conventional location)

## Read-set

- `residual-tracker.md`, all task journal entries, `buckets.json`
- `docs/known-divergences.md` (existing A1–A9 format to match)

## Acceptance criteria

- **Given** the merged tree, **when** fully swept, **then** every one of the
  original 95 diverged ids is `pass` or classified (0 unclassified).
- **Given** each accept-class item, **then** a `known-divergences.md` entry +
  journal reference exists (and a comparison page where required).
- **Given** the broad gate, **then** 0 net regressions vs baseline (BY ID) and
  `bash test/golden/gates.sh` exits 0.
- **Given** the journal, **then** it ends with a mission summary.

## Observability / Rollback

N/A / Reversible.

## Commit

`docs(T6): classify + document neato residual divergences; final sweep`.
Then the branch is ready for a **merge commit** (not squash) to main.
