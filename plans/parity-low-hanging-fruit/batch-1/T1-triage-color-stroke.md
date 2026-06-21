# T1 — Triage color-stroke (9)

Follow the shared methodology in [overview.md](overview.md). Read-only — no
`src/` edits.

## Cases
`1896 2325 2470 2801 graphs-b155 graphs-grdcluster graphs-style share-proc3d windows-proc3d`

## Known/seed (verified during planning)
- `1896`: port emits `#1E1E1E` (verbatim, uppercase) where oracle emits
  `#1e1e1e`. Root cause: **hex colors emitted verbatim, not lowercased**. Fix
  module: `src/render/color-resolve.ts` (its header says `#hex` is emitted
  verbatim; graphviz canonicalizes to lowercase `#rrggbb`). Verdict: **simple**.
  Check how many of the other 8 share this exact cause (uppercase hex in input).
- `*proc3d` / `grdcluster` / `style`: inspect for default-fill or gradient
  (`svg-gradient.ts`) causes — classify each.

## Write-set
`plans/parity-low-hanging-fruit/triage/color-stroke.md` (create)

## Acceptance criteria
- Given the 9 cases, when triaged, then each has a concrete port-vs-oracle fill/
  stroke diff, a one-line root cause, a simple/deep verdict, and a named fix
  module.
- Given the hex-case cases, then they are grouped under one shared root cause
  with `src/render/color-resolve.ts` as the fix module.

## Observability / Rollback
N/A — read-only analysis. Reversible (doc only).

## Quality bar
No src edits; `git diff --name-only` shows only the one triage doc. Commit:
`docs(triage): color-stroke parity bucket`.
