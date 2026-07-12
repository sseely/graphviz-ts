# T11 — JSON Emitter Fixes

## Context

`src/render/json.ts` is the port's JSON output emitter, ported from the
C plugin `plugin/core/gvrender_core_json.c`. A separate in-flight track
(not part of this brief) is producing a baseline survey:
`test/corpus/json-parity.json` + `PARITY-JSON.md`. This task triages
and fixes that baseline's divergence buckets.

**Gated**: do not start until `test/corpus/json-parity.json` and
`PARITY-JSON.md` exist. If they don't yet, work T12 first or wait.

## Task

1. Read `PARITY-JSON.md` and `json-parity.json` to enumerate baseline
   divergence buckets.
2. For each bucket, diagnose per `~/.claude/rules/diagnosis.md`
   (instrument before hypothesizing, state the mechanism before
   fixing) by comparing `src/render/json.ts` against
   `~/git/graphviz/plugin/core/gvrender_core_json.c` for the
   corresponding emission path.
3. Fix at the mechanism's origin in `src/render/json.ts`. Do not
   simplify or reorder the C's emission logic — port every branch, per
   this repo's CLAUDE.md ("The C Source Is Sacred").
4. Re-survey after each fix (re-run whatever script produced
   `json-parity.json`) and confirm 0 regressions before moving to the
   next bucket.
5. Any bucket that isn't a port defect (e.g. a genuine JSON-formatting
   convention difference that's out of scope) gets handed to T13, not
   silently dropped — leave it in the baseline as a residual, do not
   invent an acceptance here.

## Write-set

- `src/render/json.ts`
- `src/render/json.test.ts` (extend per TDD — write the failing test
  first, per `~/.claude/rules/testing.md`)

## Read-set

- `test/corpus/json-parity.json`, `PARITY-JSON.md` (baseline, produced
  by the in-flight JSON track)
- `~/git/graphviz/plugin/core/gvrender_core_json.c` (canonical C source
  for this emitter)
- `src/render/json.ts` (current port, full file — it's the emitter
  under repair)

## Architecture decisions

None new — this task follows the project's standing "C source is
sacred" rule (CLAUDE.md) and the diagnosis-mode rule
(`~/.claude/rules/diagnosis.md`), not a D-numbered ADR from this brief.

## Interface contracts

No new interfaces. The JSON emitter's public shape (whatever
`getRender`/`render` entry points `src/render/json.ts` already
exposes) must not change — only its internal emission fidelity.

## Acceptance criteria

- Every JSON baseline divergence bucket is fixed (re-survey clean) or
  handed to T13 as a documented residual — no bucket silently ignored.
- Each fix is preceded by a stated mechanism (diagnosis.md artifact:
  cause, `file:line`, causal chain, what was ruled out) in the
  decision journal.

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` green including new/updated
`json.test.ts` cases. Fresh re-survey after the batch shows 0
regressions against the pre-batch baseline.

## Observability

N/A — no new observable runtime operations; this is a rendering-
fidelity fix to an existing emitter.

## Rollback

Reversible — `git revert`; no migrations.
