# T3 — Oracle-Error Classifier

## Context

`parity-{neato,fdp,sfdp}.json` each carry a nonzero `oracle-error`
count (neato 7, fdp 15, sfdp 7) and fdp has 1 `timeout`. Per D6, these
need to be split into `native-crash` (genuinely irreproducible — the
oracle itself fails 3/3 reruns) vs `timeout-flake` (transient, excluded
from the current run but not written off).

## Task

1. Write `test/corpus/oracle-error-classifier.ts`: given a
   `parity-<engine>.json`, for every row with `status in
   {'oracle-error','timeout'}`, rerun the oracle invocation up to 3×
   with escalating timeouts (reuse `engine-walk.ts`'s oracle
   `execFileSync` call, raising its `timeout` option each attempt —
   e.g. 60s, 120s, 240s). 3/3 failures → `native-crash`. Any success
   within 3 attempts → `timeout-flake`.
2. Write `oracle-errors-<engine>.json` with the classified results
   (see Interface contracts).
3. Add a report hook consumed by T2's `parity-report.ts` (a small
   exported function, e.g. `renderOracleErrorsSidecar(engine)`) so the
   per-engine page shows a short sidecar section: N native-crash
   (documented, excluded) / M timeout-flake (excluded this run, note
   to retry). Coordinate the exact hook signature with whoever lands
   T2 first — if T2 is already merged, read its `parity-report.ts`
   changes before adding the hook; if this task lands first, keep the
   hook a standalone exported function so T2 can wire it in without a
   merge conflict.

## Write-set

- `test/corpus/oracle-error-classifier.ts` (new)
- `test/corpus/oracle-errors-<engine>.json` (generated output, one per
  touched engine)
- `test/corpus/parity-report.ts` (small addition: the sidecar hook
  call-site only — coordinate with T2, see Task step 3)

## Read-set

- `test/corpus/engine-walk.ts:53-54,109-127` — oracle invocation
  pattern and timeout handling to reuse.
- `plans/decision-journal.md:96` — the 2026-07-11 orphan-hardening
  entry (detached spawn + process-group SIGKILL) — the classifier's
  reruns must not reintroduce the 20h-orphan class of bug.
- `test/corpus/parity-neato.json`, `parity-fdp.json`, `parity-sfdp.json`
  — read the `counts.oracle-error` / `counts.timeout` fields and a few
  `oracle-error` rows to confirm the `err` field shape you're
  classifying.

## Architecture decisions

D6 (3-rerun classification; native-crash vs timeout-flake).

## Interface contracts

`oracle-errors-<engine>.json`:

```json
{
  "generatedAt": "ISO-8601",
  "engine": "neato",
  "results": [
    {
      "id": "string",
      "classification": "native-crash | timeout-flake",
      "attempts": 3,
      "lastErr": "string"
    }
  ]
}
```

## Acceptance criteria

- As D6: an id failing all 3 reruns is `native-crash`; an id that
  succeeds on any rerun is `timeout-flake`.
- `oracle-errors-<engine>.json` is produced for every engine passed on
  the CLI, and is rendered by T2's report section (verify visually
  once both tasks have landed).

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` green. Run the classifier
once on all three engines' `oracle-error`/`timeout` rows as a smoke
test; confirm process count returns to baseline after the run (no
orphaned reruns).

## Observability

N/A for the classifier itself. The rerun budget (3 attempts, 60/120/
240s) is this task's only tunable — if oracle flakiness needs a
different budget, log the change and why in the decision journal
rather than silently adjusting it.

## Rollback

Reversible — `git revert`; no migrations.
