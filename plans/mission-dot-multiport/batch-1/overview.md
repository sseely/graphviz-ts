# Batch 1 — diagnose + faithful fix

Single batch, **sequential** (T2 depends on T1's confirmed diagnosis). Same
primary file region, so not parallelizable.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Faithful C-vs-TS diagnosis of G2; confirm `accumCross` tiebreak metric and that `port.p.x` is populated pre-mincross | opus | `docs/dot-g2-trace.md` | — | [x] |
| T2 | TDD oracle pin + faithful `accumCross` tiebreak fix (`p.x` like C); verify 25/25 corpus + all goldens byte-identical; update status docs | opus | `src/layout/dot/mincross-cross.ts`, `src/layout/dot/mincross-port-order.test.ts` (new), `plans/layout-engine-backlog/route-reverification.md`, `plans/layout-engine-backlog/gaps/dot.md`, `plans/port-catalog/README.md` | T1 | [x] |

## Dependency summary

T1 is read-only except its trace doc; T2 reads the trace and implements. If T1
triggers AD-4 (re-scope), T2 does not start — STOP for human input.

## Stop conditions

STOP and wait for human input when:
- **AD-4 fires** — T1 shows root cause is port-resolution timing, not the
  `accumCross` tiebreak (`port.p.x` unset at mincross time).
- **Any golden churns** (AD-3) — a porting bug, not a new-correct case.
- A fix needs to modify a file outside the task's declared write-set.
- 2 consecutive quality-gate failures on the same check.
- The same code location is changed 3× without resolving the same failing check.
- An architecture decision in `decisions.md` is contradicted.

## Push-forward with judgment when:

- A hook limit (CCN 10 / 30-line fn / 500-line file) forces splitting a helper —
  split it and log the split in the decision journal.
- A choice is purely stylistic and does not change routed geometry or order.
- The 2nd corpus port case (`compass ports`, `record ports`) needs a ≤0.5pt
  tolerance pin rather than byte-exact — use it (those are pre-existing
  sub-pixel "near" residuals, not this mission's target; just prove no
  regression).

## Quality gates

Run all gates from [../README.md](../README.md) after T2 (T1 only writes a doc;
run `tsc` + the doc exists). Log gate results in `decision-journal.md`.
