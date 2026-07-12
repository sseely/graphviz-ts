# T2 — Class-Acceptance Reports

## Context

`test/corpus/accepted-divergences-engines.json` already holds per-id
accepted-divergence entries for circo/twopi/osage/patchwork (see its
`twopi` block for the existing `A1` shape convention). This mission
adds `A1-drift` **class** entries for neato/fdp/sfdp per D2: instead of
hand-listing every exonerated id, the class is computed at report time
from `attribution-<engine>.json` (T1's output).

## Task

1. Add one `"A1-drift"` class entry per engine (`neato`, `fdp`, `sfdp`)
   to `test/corpus/accepted-divergences-engines.json`, following the
   registry's existing per-engine/per-id shape but with a `class` block
   instead of a hand-enumerated id list — see Interface contracts.
2. Extend `test/corpus/parity-report.ts` so that, for engines with an
   `A1-drift` class entry, it loads the matching
   `attribution-<engine>.json`, computes membership
   (`results[].verdict === 'drift-exonerated'`), and renders those ids
   as an accepted-class group (collapsible/linked, not inlined as a
   full table — follow the existing `PARITY-<engine>.md` roster-brevity
   convention: link the JSON, don't enumerate 400+ ids, per the
   2026-07-11 journal entry on `PARITY-dot.md`/`PARITY-XDOT.md`).
   Exonerated ids are subtracted from the page's "Diverged" table and
   counted separately in the Summary section.
3. Extend the corpus guard tests (find the existing test that validates
   `accepted-divergences*.json` entries) to also validate `class`
   entries: the referenced `attribution-<engine>.json` must exist and
   be well-formed; do not require every member id to be individually
   listed anywhere.

## Write-set

- `test/corpus/accepted-divergences-engines.json`
- `test/corpus/parity-report.ts`
- the existing accepted-divergences guard test file (find via Read-set)

## Read-set

- `test/corpus/accepted-divergences-engines.json` (full file — small,
  read it whole for the exact per-id/per-class shape convention)
- `test/corpus/parity-report.ts` — current per-engine page rendering,
  and the roster-brevity change referenced in
  `plans/decision-journal.md` (search for "conformant-roster brevity")
- Find the accepted-divergences guard test via
  `grep -rl "accepted-divergences-engines" test/` and read it in full —
  it's the contract this task must not break.

## Architecture decisions

D2 (class acceptance is computed, not enumerated — membership must be
derivable purely from `attribution-<engine>.json`, never duplicated
into the registry).

## Interface contracts

Class entry shape in `accepted-divergences-engines.json`:

```json
{
  "neato": {
    "A1-drift": {
      "class": true,
      "attributionFile": "attribution-neato.json",
      "ref": "known-divergences.md#a1-drift-iterative-engines"
    }
  }
}
```

## Acceptance criteria

- Given an `A1-drift` class entry and its `attribution-<engine>.json`,
  when `parity-report.ts` runs, then exonerated ids are counted as
  accepted-class members (linked, not inlined) and removed from the
  Diverged table.
- Given an id that later starts passing outright (moves from
  `diverged` to `pass` in a fresh `engine-walk.ts` sweep), when the
  next report regen runs, then it silently leaves the class with no
  guard-test failure.
- Guard tests cover both the per-id shape (existing) and the new
  `class` shape.

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` green, including the
extended guard tests. Regenerate all `PARITY-*.md` pages once and
visually confirm no 400+-row table was accidentally inlined.

## Observability

N/A — no new observable runtime operations; this is dev-tooling.

## Rollback

Reversible — `git revert`; no migrations.
