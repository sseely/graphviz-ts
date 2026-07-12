# T14 — Wrap

## Context

Final task of the mission. All fix/accept work is done (batches 1–5
complete); this task verifies the whole feature branch is clean, ships
the docs site, and closes out the brief.

## Task

1. Run every quality gate in `README.md` fresh (delete all touched
   `.jsonl`/`.json` sweep artifacts first — no resumed sweeps) across
   neato, fdp, sfdp, and the dot track (`survey.ts`). All must be 0
   regressions against the last-committed baseline.
2. `npm run docs:build` (runs `docs:copy-reports` then `vitepress
   build`) — confirms the docs site picks up the final
   `PARITY-*.md`/`known-divergences.md` state without errors.
3. Merge `feature/xdot-conformance` to `main` via merge commit (per
   `~/.claude/rules/autonomous-execution.md` — mission-brief branches
   use merge commits, never squash, since this brief's decision journal
   references per-task commit IDs). Pushing to `main` triggers
   `.github/workflows/docs.yml`'s GitHub Pages deploy — confirm the
   deployment succeeds (check the Actions run).
4. Write the mission summary at the bottom of `README.md`: tasks
   completed vs. planned, decision count (with any flagged for human
   review), quality-gate results, known issues/follow-ups (e.g. any
   `named-open-mechanism` ids still outstanding per D3 — these are a
   valid, documented end state, not a failure, but must be listed).
5. Cross-reference this brief's `decision-journal.md` from the
   top-level `plans/decision-journal.md` (one summary row pointing
   here), and add/refresh a `.agent-notes/` entry per
   `~/.claude/rules/memory.md` covering the final A1-drift class
   mechanism and the fdp `clusteredges-gap` outcome (fixed or accepted,
   whichever it turned out to be).

## Write-set

- `plans/iterative-parity-campaign/README.md` (Summary section)
- `plans/decision-journal.md` (one cross-reference row)
- `.agent-notes/*.md` (new or updated entry per memory.md conventions)
- no `src/` changes expected in this task — it verifies, ships, and
  documents; if a gate fails and needs a fix, that fix is a separate
  task-scoped commit, not folded into T14's commit

## Read-set

- `README.md` (this brief's full quality-gates + batch table)
- `~/.claude/rules/autonomous-execution.md` (merge-commit policy,
  session-end summary format)
- `~/.claude/rules/memory.md` (`.agent-notes/` entry format)
- `.github/workflows/docs.yml` (confirm what triggers the deploy before
  claiming success)

## Architecture decisions

D3 (completion bar — the summary must state, per engine, how many ids
landed in each of the four buckets: fixed / A1-drift-exonerated /
irreducible-accepted / named-open-mechanism).

## Interface contracts

None new.

## Acceptance criteria

- All tracks fresh, 0 regressions.
- Docs site builds clean and the GitHub Pages deploy succeeds after
  merge to `main`.
- `README.md` Summary section is complete per D3's four-bucket
  accounting for neato/fdp/sfdp, plus the JSON/imagemap track outcome.

## Quality bar

Every gate in `README.md`'s Quality gates table passes, run fresh, in
this task.

## Observability

N/A — no new observable runtime operations. The docs-site deploy's
success/failure is observed via the GitHub Actions run, not a new
metric.

## Rollback

Reversible — `git revert` the merge commit if the deploy fails; no
migrations. The merge-commit policy (not squash) makes this safe:
reverting preserves every per-task commit for later re-application.
