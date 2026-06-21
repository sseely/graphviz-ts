# T7 — Fix text-content simple cases

Follow the shared fix methodology in [overview.md](overview.md). Read
`triage/text-content.md` first. Depends on T6.

## Task
Implement each confirmed-simple text-content root-cause group (e.g. label
escaping, entity encoding, `<title>` content). One commit per group; one golden
per group. Per ADR-5, Latin1/Symbol charset cases are **deep** — create
comparison pages, do NOT attempt the encoding infrastructure.

## Write-set
- The text-emit / label module named in the triage doc (likely
  `src/common/make-label.ts` or `src/render/svg-*.ts`) + its test
- golden add (`test/golden/inputs|refs/<id>.*`, `manifest.json`, `suite.test.ts`)
- `plans/parity-low-hanging-fruit/comparisons/<id>.md` (per deferred case)

## Acceptance criteria
- Given each simple case, when fixed, then its `text()` first-diff is resolved and
  byte-matches the oracle.
- Given Latin1/Symbol cases, then each has a comparison page marking it deep.
- Given the golden suite, then green; 0 per-id regressions.

## Observability / Rollback
N/A. Reversible.

## Quality bar
`npm run typecheck && npm test` exit 0. Commit(s):
`fix(label): <root cause> (parity)`.
