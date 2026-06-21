# T5 — Triage parser-gap (10)

Follow the shared methodology in [overview.md](overview.md). Read-only.

## Cases
`1308_1 1367 1474 1489 1494 1676 2682 graphs-russian share-Latin1 windows-Latin1`

## Hints
These ERRORED: the peggy parser threw `ParseError`/`Expected …` where native
`dot` accepts the input. For each: capture the exact parse error + the offending
DOT construct (the few chars around the failure). Root cause = a specific grammar
gap (e.g. an accepted token/escape/charset the peggy grammar rejects). Fix module
is the grammar `src/parser/dot.pegjs` (+ regenerated `dot.js`) or
`src/parser/*.ts`.

- `share-Latin1` / `windows-Latin1` / `graphs-russian`: likely the SAME non-UTF8
  charset issue as ADR-5 (the bytes break the parser) — presume **deep**, defer.
- The numbered cases (`1308_1`, `1367`, …) pin GitLab issues — per memory
  ("Issue-numbered tests → consult the MR"), note the issue number; a localized
  grammar fix may be simple.

NOTE: a grammar fix requires regenerating `dot.js` from `dot.pegjs` (peggy) — flag
that as part of the fix plan (Batch 2 owns the regeneration; triage only plans).

## Write-set
`plans/parity-low-hanging-fruit/triage/parser-gap.md` (create)

## Acceptance criteria
- Given the 10 cases, when triaged, then each has the exact parse error, the
  offending construct, a root cause, a simple/deep verdict, and the grammar fix
  plan.
- Given the Latin1/russian cases, then they are marked deep per ADR-5.

## Observability / Rollback
N/A — read-only. Reversible.

## Quality bar
No src edits. Commit: `docs(triage): parser-gap bucket`.
