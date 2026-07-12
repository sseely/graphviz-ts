# T12 — Imagemap Emitter Fixes

## Context

`src/render/map.ts` is the port's imagemap (cmapx + imap) output
emitter, ported from the C plugin `plugin/core/gvrender_core_map.c`. A
separate in-flight track (not part of this brief) is producing a
baseline survey: `test/corpus/map-parity.json` + `PARITY-MAP.md`. This
task triages and fixes that baseline's divergence buckets.

**Gated**: do not start until `test/corpus/map-parity.json` and
`PARITY-MAP.md` exist. If they don't yet, work T11 first or wait.

## Task

1. Read `PARITY-MAP.md` and `map-parity.json` to enumerate baseline
   divergence buckets.
2. For each bucket, diagnose per `~/.claude/rules/diagnosis.md`
   (instrument before hypothesizing, state the mechanism before
   fixing) by comparing `src/render/map.ts` against
   `~/git/graphviz/plugin/core/gvrender_core_map.c` for the
   corresponding emission path. Note existing test infra:
   `src/render/map-renderers.test.ts` and `src/render/map-test-helpers.ts`
   already exist — read them before adding new test scaffolding to
   avoid duplicating helpers.
3. Fix at the mechanism's origin in `src/render/map.ts`. Do not
   simplify or reorder the C's emission logic — port every branch, per
   this repo's CLAUDE.md ("The C Source Is Sacred").
4. Re-survey after each fix and confirm 0 regressions before moving to
   the next bucket.
5. Any bucket that isn't a port defect gets handed to T13 as a
   documented residual, not silently dropped.

## Write-set

- `src/render/map.ts`
- `src/render/map.test.ts` (extend per TDD)
- `src/render/map-renderers.test.ts` if a fix requires new
  renderer-level coverage (reuse `map-test-helpers.ts`, don't fork it)

## Read-set

- `test/corpus/map-parity.json`, `PARITY-MAP.md` (baseline, produced
  by the in-flight imagemap track)
- `~/git/graphviz/plugin/core/gvrender_core_map.c` (canonical C source)
- `src/render/map.ts`, `src/render/map-test-helpers.ts` (current port
  and existing test helpers — read both before writing new fixtures)

## Architecture decisions

None new — follows CLAUDE.md's "C source is sacred" rule and
`~/.claude/rules/diagnosis.md`.

## Interface contracts

No new interfaces. The imagemap emitter's public shape must not
change — only its internal emission fidelity (cmapx HTML shape
attributes, imap coordinate lines, href/title escaping, etc., per
whatever the baseline buckets turn out to be).

## Acceptance criteria

- Every imagemap baseline divergence bucket is fixed (re-survey clean)
  or handed to T13 as a documented residual.
- Each fix is preceded by a stated mechanism in the decision journal.

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` green including
`map.test.ts` and `map-renderers.test.ts`. Fresh re-survey shows 0
regressions.

## Observability

N/A — no new observable runtime operations.

## Rollback

Reversible — `git revert`; no migrations.
