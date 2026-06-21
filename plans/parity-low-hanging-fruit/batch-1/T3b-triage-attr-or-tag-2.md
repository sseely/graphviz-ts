# T3b — Triage attr-or-tag, part 2 (16)

Follow the shared methodology in [overview.md](overview.md). Read-only.

## Cases
`graphs-b7 graphs-b79 graphs-newarrows graphs-rd_rules graphs-root graphs-triedds graphs-user_shapes linux.x86-arrows_dot linux.x86-root_circo linux.x86-root_twopi macosx-arrows_dot nshare-arrows_dot nshare-root_circo nshare-root_twopi share-triedds windows-triedds`

## Hints
Same bucket semantics as T3a. Note the duplicated families across platforms
(`*-arrows_dot`, `*-root_circo`, `*-root_twopi`, `*-triedds`) — these are the
SAME input rendered under different engines/platforms, so they very likely share
ONE root cause each. Group aggressively: a single fix may clear a whole family.
`*-root_circo`/`*-root_twopi` use non-dot engines — confirm the engine from the
manifest and classify (a non-dot-engine attribute gap may still be simple).

## Write-set
`plans/parity-low-hanging-fruit/triage/attr-or-tag-2.md` (create)

## Acceptance criteria
- Given the 16 cases, when triaged, then each has a concrete diff + root cause +
  simple/deep verdict + fix module.
- Given the cross-platform families, then each family is collapsed to one shared
  root cause in the summary.

## Observability / Rollback
N/A — read-only. Reversible.

## Quality bar
No src edits. Commit: `docs(triage): attr-or-tag parity bucket part 2`.
