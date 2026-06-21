# T3a — Triage attr-or-tag, part 1 (17)

Follow the shared methodology in [overview.md](overview.md). Read-only.

## Cases
`1408 1447_1 1453 1622_0 1880 2183 2184 2242 2258 2497 2563 2592 2613 2734 42 705 graphs-arrows`

## Hints
`attr-or-tag` = the first diff is an element tag or a non-coordinate attribute
(not fill/stroke/points/text/path). Common simple causes: a missing or wrongly
named SVG attribute, a tag substitution (`polygon` vs `path`), an
`id`/`class`/`stroke-dasharray`/`text-anchor` difference. `graphs-arrows` and
arrow-related ids likely share an arrowhead-attribute cause — group them.
Classify each simple vs deep; name the fix module (likely under `src/render/`).

## Write-set
`plans/parity-low-hanging-fruit/triage/attr-or-tag-1.md` (create)

## Acceptance criteria
- Given the 17 cases, when triaged, then each has a concrete diff + root cause +
  simple/deep verdict + fix module.
- Given any shared-cause cluster (e.g. arrows), then it is grouped in the summary.

## Observability / Rollback
N/A — read-only. Reversible.

## Quality bar
No src edits. Commit: `docs(triage): attr-or-tag parity bucket part 1`.
