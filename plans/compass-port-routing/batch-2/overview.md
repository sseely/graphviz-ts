# Batch 2 — fix compass-port endpoint placement

After Batch 1. T3 depends on T1; T4 depends on T2. **T3 and T4 run in parallel
ONLY if their write-sets are disjoint** (the regular path is likely
`edge-route-boxes.ts`/`splines-path-*.ts`; the flat path is `splines-flat.ts`).
If T1 and T2 named the SAME function, collapse T3+T4 into a single task (one
commit) — log the decision.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Faithfully port the regular-edge compass-port branch (from T1); add a colocated regression test | opus | `src/<T1 file>` + `src/<T1 file>.test.ts` | T1 | [ ] |
| T4 | Faithfully port the flat-edge compass-port branch (from T2); add a colocated regression test | opus | `src/<T2 file>` + `src/<T2 file>.test.ts` | T2 | [ ] |

## Parallelism / write-set rule
Before launching T3+T4 together, confirm `git diff --name-only` write-sets are
disjoint. If they overlap (same file), serialize or merge into one task —
one writer per file (`parallelism.md`).

## Stop conditions
Per README. AD-4 applies: if the fix needs files outside the T1/T2 write-set
or a deeper routing change → STOP.

## Quality gates
All gates from [../README.md](../README.md). Snapshot `parity.json` before each
fix's survey run; require 0 regressions + the target id(s) improve verdict.
