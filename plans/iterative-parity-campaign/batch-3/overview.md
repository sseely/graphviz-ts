# Batch 3 — Repeating Fix/Accept Rounds

Batch-3 has no fixed task list. It runs a repeating round protocol
until every diverged id across neato/fdp/sfdp is `fixed`,
`A1-drift-exonerated`, `irreducible-accepted`, or `named-open-mechanism`
(D3). Rounds are named `3a`, `3b`, `3c`, … in the order run; each gets a
row in `decision-journal.md`, not a separate task file.

## Round protocol (repeat per round)

1. **Pick the target.** Across the three engines' `<engine>-buckets.md`
   docs (batch-2), pick the single largest bucket that is not yet
   cleared (not already `A1-drift-exonerated` or `irreducible-accepted`
   in the current `attribution-<engine>.json`). fdp's `clusteredges-gap`
   bucket (if T5 confirmed it) is a standing candidate — treat it as a
   normal bucket-priority pick, not an automatic first round.
2. **Diagnose.** `EnterWorktree`, then dispatch an Opus diagnosis agent
   on one representative id from that bucket, following
   `~/.claude/rules/diagnosis.md`: instrument before hypothesizing, no
   fix before a stated mechanism (cause, `file:line`, causal chain,
   what was ruled out). Diagnosis agents that instrument port code
   MUST run inside the worktree — never the main tree (memory:
   "Diagnosis agents instrumenting port code MUST isolation:worktree").
3. **Resolve** one of two ways:
   - **Fix**: apply the change at its root (per diagnosis.md's "scope
     of change" rule), in the worktree. Merge back to the main tree.
     Run a **fresh** sweep (`rm -f` the `.jsonl` first — resume-style
     sweeps hide regressions) for the touched engine(s); gate is 0
     pass→diverged regressions.
   - **Irreducible-accepted**: if the mechanism is a genuine, bounded,
     documented FP/platform difference (cf. the twopi-arrows A1-drift
     precedent, or the `A9` ULP-tie-break class in the accepted
     registry) and doesn't fit the A1-drift class signature, accept it
     per-id in `accepted-divergences-engines.json` with prose — not as
     a class entry (D2's class entry is reserved for the harness-
     detected A1-drift shape specifically).
4. **Re-run attribution** for the touched engine (T1's harness) so
   `attribution-<engine>.json` reflects the round's outcome.
5. **Journal the round**: one row in `decision-journal.md` — mechanism,
   files touched, ids affected (fixed count + accepted count), gate
   result.

## Loop stop condition

All remaining diverged ids across all three engines are
drift-exonerated, accepted, or named-open-mechanism (tracked but not
yet resolved — record these explicitly rather than leaving them
silently unclassified). When reached, proceed to batch-4.

## Known lead

fdp's `clusteredges.c` (compound cluster-edge routing) is unported per
`plans/port-catalog/README.md:358`. If batch-2's T5 bucket analysis
confirms a bucket maps to this gap, that round's diagnosis step can
skip straight to scoping the port rather than re-deriving the mechanism
from scratch — but still follow the full diagnosis.md discipline for
the specific corpus ids involved (the catalog entry says the file is
unported, not which of fdp's diverged ids it explains).

## Stop conditions specific to this batch

Same as `README.md`'s global list, plus: the consecutive-fix stop rule
applies per bucket — if the same code location is changed 3× in a row
across rounds without resolving that bucket's failure, stop and log to
`decision-journal.md` per `~/.claude/rules/autonomous-execution.md`.
