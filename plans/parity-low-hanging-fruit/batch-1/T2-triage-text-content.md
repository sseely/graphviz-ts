# T2 — Triage text-content (7)

Follow the shared methodology in [overview.md](overview.md). Read-only.

## Cases
`1990 graphs-Latin1 graphs-Symbol graphs-b34 graphs-b56 graphs-b60 graphs-b81`

## Known/seed (verified during planning)
- `graphs-Latin1` / `graphs-Symbol`: port emits replacement chars (`���`) where
  oracle emits Latin-1 / Symbol glyphs. Root cause: **non-UTF8 input + `charset`
  attribute not handled** (harness reads file as UTF-8). Per ADR-5 presume
  **deep** — confirm whether any localized fix exists; otherwise defer with a
  comparison page in Batch 2/3.
- `1990`: `title[1]/text()` differs — the `<title>` element text (node/edge id).
  Likely a label/title escaping or content difference — classify simple vs deep.
- `graphs-b34/b56/b60/b81`: inspect each `text()` diff — escaping, entity
  encoding (`&amp;` etc.), or content. Group shared causes.

## Write-set
`plans/parity-low-hanging-fruit/triage/text-content.md` (create)

## Acceptance criteria
- Given the 7 cases, when triaged, then each has a concrete text diff + root
  cause + simple/deep verdict + fix module.
- Given the Latin1/Symbol cases, then they are marked deep (or a localized fix is
  explicitly justified) per ADR-5.

## Observability / Rollback
N/A — read-only. Reversible.

## Quality bar
No src edits. Commit: `docs(triage): text-content parity bucket`.
