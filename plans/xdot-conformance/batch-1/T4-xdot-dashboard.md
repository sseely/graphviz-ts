# T4 — xdot-dashboard.ts

## Context
The SVG survey has `test/corpus/dashboard.ts` which renders `PARITY.md` from
`parity.json`. This is the xdot analogue: `PARITY-XDOT.md` from `xdot-parity.json`.

## Task
Create `test/corpus/xdot-dashboard.ts`: read `test/corpus/xdot-parity.json` (T3),
write `test/corpus/PARITY-XDOT.md`. Mirror `dashboard.ts` structure so the two
dashboards read alike.

Content (front-loaded):
- Header line: oracle, total, generatedAt.
- Counts table (conformant / diverged / accepted / errors / timeout) with a
  conformant percentage.
- "Next problems" table: the diverged items sorted by ascending `size`, columns
  `id | path | size | first-diff (object/drawKey/field)` — the top of this list is
  literally the fix queue.
- Accepted-divergences section: ids from `accepted-divergences-xdot.json` with
  rationale.

## Read-set
- `test/corpus/dashboard.ts` (whole file — mirror its Markdown shape)
- T3's `xdot-parity.json` interface contract

## Acceptance criteria
- Given a valid `xdot-parity.json`, when `npx tsx test/corpus/xdot-dashboard.ts`,
  then `PARITY-XDOT.md` is written with the counts table and a conformant %.
- Given diverged results, when run, then the "Next problems" table lists them
  ascending by size with the first diff summarized.

## Observability / rollback
N/A. Reversible (new file).

## Quality bar
`npx tsc --noEmit` clean. One commit: `test(xdot): add PARITY-XDOT dashboard`.
