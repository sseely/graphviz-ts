# Batch 2 — FLATEDGE-gate the box-x to C

After Batch 1. T2 depends on T1's pinned line + correct x-reference. Single fix
task.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | FLATEDGE-gate the end-box x-reference to match C (per T1: node centre, not node edge); add a colocated regression test | opus | `src/<T1 file(s)>` + a colocated `*.test.ts` | T1 | [ ] |

## Gating note (AD-5)
The fix MUST be gated to the flat-edge path (et === FLATEDGE / the makeFlatEnd
call site). Regular-edge box-x is UNTOUCHED. A regular-edge golden changing is a
STOP signal. Confirm via `git diff --name-only` that only the FLATEDGE branch
changed, and that the 128 goldens stay byte-identical.

## Stop conditions
Per README. AD-4/AD-5: if gating is not possible without altering regular-edge
box construction -> STOP.

## Quality gates
All gates from [../README.md](../README.md). Snapshot `parity.json` before T2's
survey run; require 0 regressions + `241_0`'s non-adjacent flat edges improve
(and ideally the bbox shift shrinks / cardinal edges land at the oracle y).
