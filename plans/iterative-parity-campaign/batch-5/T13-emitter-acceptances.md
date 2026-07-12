# T13 — Emitter Acceptances

## Context

T11 and T12 fix what's fixable in the JSON and imagemap emitters and
hand off any residual (non-defect) divergences. This task wires those
residuals into the standard accepted-divergence flow so the two new
tracks report cleanly, matching the convention already used for the
per-engine xdot tracks.

## Task

1. Collect T11's and T12's documented residuals (from their decision
   journal entries — read both before starting).
2. Create `test/corpus/accepted-divergences-json.json` and
   `test/corpus/accepted-divergences-map.json`, following the shape
   convention of `test/corpus/accepted-divergences-engines.json`
   (per-id entries with `class`/`bound`/`ref` fields — reuse that
   shape rather than inventing a new one; these two new registries are
   simpler since there is no A1-drift-style computed class here, only
   per-id documented acceptances).
3. Wire whatever report generator the JSON/imagemap tracks use (find
   it — likely a `json-report.ts`/`map-report.ts` sibling to
   `parity-report.ts`, or an extension of `parity-report.ts` itself,
   depending on what the in-flight track builders landed) to subtract
   accepted ids from their Diverged tables, mirroring T2's
   (batch-1) treatment for the engine tracks.
4. Add prose for each accepted residual to `docs/known-divergences.md`
   (new section per track, or an addition to an existing section if
   one of the in-flight tracks already started one — check before
   creating a duplicate heading).

## Write-set

- `test/corpus/accepted-divergences-json.json` (new)
- `test/corpus/accepted-divergences-map.json` (new)
- the JSON/imagemap report generator (path TBD — determine from what
  the in-flight tracks landed; do not guess a path that doesn't exist)
- `docs/known-divergences.md`

## Read-set

- T11's and T12's decision-journal entries (residuals list)
- `test/corpus/accepted-divergences-engines.json` (shape convention to
  mirror)
- `test/corpus/parity-report.ts` (or whatever T2, batch-1, evolved it
  into) — the acceptance-subtraction pattern to mirror
- `docs/known-divergences.md` — existing section structure

## Architecture decisions

None new — mirrors D2's spirit (accepted divergences are documented,
not silently dropped) applied to two new emitter tracks; these are
per-id acceptances, not a computed class, so D2's specific
"class is computed not enumerated" mechanism does not apply here.

## Interface contracts

`accepted-divergences-{json,map}.json` shape mirrors
`accepted-divergences-engines.json`'s per-id entry shape:

```json
{
  "<id>": {
    "class": "string (freeform label, not one of D2's engine classes)",
    "bound": "string (what diverges, quantified)",
    "ref": "known-divergences.md#anchor"
  }
}
```

## Acceptance criteria

- Every T11/T12 residual is either fixed upstream (in which case it
  should NOT appear here — re-check before wiring) or has exactly one
  entry in the appropriate `accepted-divergences-{json,map}.json` file
  with matching `docs/known-divergences.md` prose.
- Reports for both tracks regenerate clean with accepted ids subtracted
  from their Diverged tables.

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` green. Regenerate both
tracks' reports once and read them.

## Observability

N/A — documentation/report-wiring task.

## Rollback

Reversible — `git revert`; no migrations.
