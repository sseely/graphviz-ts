# T1 — Injection Attribution Harness

## Context

graphviz-ts is a faithful TypeScript port of Graphviz (C source at
`~/git/graphviz` is canonical). `test/corpus/engine-walk.ts` already
walks the corpus through one non-dot engine and writes
`parity-<engine>.json` (pass/diverged/oracle-error/port-error/timeout
counts + per-id rows). This task builds the next stage: for every
`diverged` id, inject the native oracle's pre-routing node positions
into the port and re-compare, to separate "port routing/emission is
wrong" from "the two engines' iterative solvers converged to
numerically different (but each internally consistent) layouts" —
the latter is not a port bug.

The injection recipe was already proven manually on 2026-07-10 (see
Read-set) — this task productizes it into a repeatable, engine-agnostic
harness.

## Task

1. Add a session-local, env-gated `%.17g` `stderr` dump patch to the
   **native C tree** (`~/git/graphviz`, never committed there) at the
   `spline_edges` entry point in `lib/neatogen`, per D1/D4 and the full
   recipe in `diagrams/injection-recipe.md` (write that recipe doc as
   part of this task, then follow it). Gate the patch on an env var
   (e.g. `GVTS_POS_DUMP=1`) so a normal build is unaffected.
2. Add a small, **committed**, env-gated injection hook in
   `src/layout/neato/splines.ts`: when `process.env.GVTS_POS_INJECT`
   points at a dump file, overwrite `n.info.pos` for matching nodes
   before the port's own routing runs. Guard with `typeof process !==
   'undefined'` so it is inert in browser bundles — document this
   guard inline with a one-line comment citing this task.
3. Write `test/corpus/attribute-divergence.ts`: for each `diverged` id
   in a `parity-<engine>.json`, run the oracle once with
   `GVTS_POS_DUMP=1` to capture positions, run the port once with
   `GVTS_POS_INJECT=<dump>`, compare against the oracle with the
   existing semantic comparator (`test/golden/compare-xdot.ts`), and
   classify buckets per D5 (firstDiff shape, uniform-translation/mirror
   detector, count-vs-position split). Support `--stage <name>` for a
   future post-init/post-overlap injection point (D1) — implement only
   the pre-routing `ND_pos` stage now; `--stage` should error clearly
   on any other value rather than silently no-op.
4. Oracle-hash guard (D4): before any run, `sha1` the oracle binary and
   compare against the hash recorded with the cached dump set; refuse
   to proceed (non-zero exit, clear message) on mismatch.
5. Resume support: if `attribution-<engine>.json` (or a `.jsonl`
   sidecar) already has entries for some ids, skip them on rerun
   unless `--fresh` is passed — mirror `engine-walk.ts`'s existing
   resume behavior.

## Write-set

- `test/corpus/attribute-divergence.ts` (new)
- `src/layout/neato/splines.ts` (new gated injection hook only — do not
  touch existing routing logic)
- `plans/iterative-parity-campaign/diagrams/injection-recipe.md`
  (write the recipe doc; already scaffolded by the mission brief author
  — fill in the exact patch diff and commands)

## Read-set

- `test/corpus/engine-walk.ts:20,53-54,109-127` — spawn pattern
  (detached + process-group `SIGKILL`; a plain `spawnSync` orphaned a
  process for 20h per the 2026-07-11 journal entry — reuse this
  pattern, do not regress it), oracle `execFileSync` call shape, and
  the `EngineWalkRow`/`EngineParityReport` types to mirror.
- `plans/decision-journal.md:86` — the 2026-07-10 injection A/B
  verdicts entry (exact POS_DUMP/POS_INJECT mechanism, twopi-arrows
  exoneration, circo counter-example).
- `.agent-notes/twopi-radial-drift-rca.md` — a prior injection-based
  RCA repro, useful as a worked example of the recipe.
- `test/golden/compare-xdot.ts` — comparator signature and diff-record
  shape (source of `firstDiff` strings you must bucket in step 3).

## Architecture decisions

D1 (stage scope — pre-routing only, `--stage` for future escalation),
D4 (dump transport, session-local native patch, hash guard), D5
(classifier buckets).

## Interface contracts

`attribution-<engine>.json`:

```json
{
  "generatedAt": "ISO-8601",
  "oracleSha1": "hex sha1 of the oracle binary used",
  "tolerance": 0.5,
  "results": [
    {
      "id": "string",
      "verdict": "drift-exonerated | not-cleared | harness-error",
      "baseDiffs": 0,
      "injectedDiffs": 0,
      "bucket": {
        "shape": "string (firstDiff-derived bucket label)",
        "uniformDelta": [0, 0],
        "mirror": false
      }
    }
  ]
}
```

`bucket.uniformDelta` and `bucket.mirror` are optional — present only
when the corresponding detector fires.

## Acceptance criteria

- Given a diverged id whose injected render conforms at ±0.5, when the
  harness runs, then `verdict = 'drift-exonerated'` and
  `injectedDiffs = 0`.
- Given an oracle sha1 mismatch against the cached dump set, when a
  sweep starts, then it refuses to run (non-zero exit, no partial
  output written).
- Given an interrupted sweep, when re-invoked without `--fresh`, then
  it resumes and reaches full coverage of the input diverged-id set.

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` green. Manually verify the
injection hook is a no-op when `GVTS_POS_INJECT` is unset (run the
existing `test/corpus` suite unaffected). Run
`attribute-divergence.ts` on neato's diverged set end-to-end once as a
smoke test before marking this task complete.

## Observability

SLIs for this task specifically (harness correctness, not a runtime
service): harness completeness (759/759 attempted ids attributed, no
silent drops) and the oracle-hash guard firing correctly on a
deliberately mismatched hash (verify by hand once).

## Rollback

Reversible — `git revert`; no migrations. The native-tree patch is
session-local and must be reverted (`git -C ~/git/graphviz checkout --
lib/neatogen/...` or equivalent) before this task is marked done —
note the revert command used in the decision journal.
