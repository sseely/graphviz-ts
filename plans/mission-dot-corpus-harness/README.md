# Mission: dot-corpus-harness — differential parity survey (dot-first)

## Objective

Build the **differential corpus harness** the port catalog has long deferred
(`plans/port-catalog/README.md` §"Verifying fidelity"): render the real
graphviz **dot** test corpus (~256+ `.gv`/`.dot` inputs) through the native
binary oracle and through graphviz-ts, diff each, and emit a **parity
dashboard** plus a **triaged divergence backlog**.

This converts "24/25 hand-picked cases pass" into a measured verdict over the
real long-tail — the exact surface where the two prior port attempts broke. It
also produces the comparison page `CLAUDE.md` requires.

**This mission does NOT fix any divergence.** The deliverable is the harness,
the dashboard from running it, and a categorized backlog. Each divergence
bucket becomes a future mission.

## Scope = dot-first

Survey only **dot-targetable** inputs (default engine, no `layout=` override).
Force-engine inputs (neato/fdp/sfdp/circo/twopi/osage) are *enumerated and
quarantined-as-deferred* — recorded for a follow-on mission, not surveyed here.
Keeps the mission bounded and on the priority engine (plantuml-js is dot-only).

## Critical constraint — separate from the curated gate

The existing `test/golden/suite.test.ts` is a **curated pass/fail gate** (128
cases that must ALL pass). The survey is a **report**, not a gate: hundreds of
inputs will legitimately diverge, and that is *data*. **Do NOT add corpus
inputs to `test/golden/manifest.json` or `suite.test.ts`** (decisions.md AD-1).
The survey reuses `test/golden/compare.ts` + `normalize.ts` read-only; all new
code lives under `test/corpus/`.

## The port can hang — subprocess isolation is mandatory

The port has no CLI, and some inputs trigger synchronous infinite loops that
cannot be interrupted in-process. Each render runs in a **spawned subprocess
with a timeout** so one bad input cannot abort the survey (hang → `timeout`,
throw → `errored`). See decisions.md AD-2.

## Branch / merge

- Branch: `feature/dot-corpus-harness` off `main`.
- Merge back with a **merge commit** (preserves per-task commit IDs).

## Execution model

Run with **opus** (`claude-opus-4-8`, native 1M context). Fable 5 is disabled —
do not route to it.

## Oracle

Native `dot` at `~/git/graphviz/build/cmd/dot/dot` (15.0.0), `GVBINDIR=/tmp/gvplugins`.
Corpus root default `~/git/graphviz/tests` (configurable). Oracle SVGs are
cached on-demand under a gitignored temp dir — **do not commit ~800 SVGs**
(AD-3).

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND the 128 curated goldens still pass
  on_fail: fix_and_rerun
- command: npx tsx test/corpus/survey.ts        # meta-gate (T2/T3)
  pass: exit 0 AND writes test/corpus/parity.json (+ PARITY.md after T3)
  on_fail: fix_and_rerun
- command: npx lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only <base>
  pass: within the task's declared write-set
  on_fail: stop
```

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 enumerate+classify, T2 survey runner, T3 dashboard+triage | [x] |

**Done (2026-06-19).** Harness under `test/corpus/` (`enumerate` → `survey` →
`dashboard`). Headline over **796 applicable** dot inputs (oracle `dot 15.1.0`):
conformant 112, structural-match 218, diverged 422, errored 20, timeout 8,
oracle-error 16. Dashboard: [`test/corpus/PARITY.md`](../../test/corpus/PARITY.md),
linked from the port catalog. No `src/` change (AD-5); curated golden gate
untouched (AD-1). Backlog buckets in PARITY.md name the follow-on fix missions.

- [decisions.md](decisions.md) — locked architecture decisions
- [batch-1/overview.md](batch-1/overview.md) — task table + stop conditions
- [batch-1/T1-enumerate.md](batch-1/T1-enumerate.md)
- [batch-1/T2-survey.md](batch-1/T2-survey.md)
- [batch-1/T3-dashboard.md](batch-1/T3-dashboard.md)
- [diagrams/survey-flow.md](diagrams/survey-flow.md)
- [decision-journal.md](decision-journal.md)

## Session summary (2026-06-19)

- **Tasks:** 3/3 complete (T1 enumerate+classify, T2 survey runner, T3 dashboard
  +triage). One batch, sequential. Merged to `main` via merge commit `734c2e9`
  (per-task commits `945fda5`, `4b0d4dd`, `157a870` preserved).
- **Deliverable:** `test/corpus/` harness (`enumerate` → `survey` → `dashboard`)
  + `corpus-manifest.json`, `parity.json`, `PARITY.md`; linked from the port
  catalog as the realized comparison page.
- **Measured (oracle `dot 15.1.0`, 796 applicable):** conformant 112,
  structural-match 218, diverged 422, errored 20, timeout 8, oracle-error 16.
- **Decisions:** 13 journal entries; two were genuine bug fixes the survey
  forced (process-group SIGKILL for the unkillable tsx grandchild; oracle
  validity by SVG completeness, not exit code). None flagged for review.
- **Gates:** tsc 0; vitest 1951 pass (128 curated goldens untouched); meta-gate
  survey exits 0 + writes parity.json; lizard clean on all 4 new files; AD-5
  verified (`git diff main -- src/` empty). Survey wall-clock ≈ 1m49s.
- **Follow-ups (the backlog IS the output):** each PARITY.md bucket is a
  candidate oracle-pinned fix mission — largest first: diverged element-count
  157, path-structure 109, color-stroke 56, font-metrics 49; errored parser-gap
  10 (Latin-1/UTF-8 strictness). Force engines (neato/fdp/sfdp/circo/twopi/
  osage) remain a deferred follow-on extending the same harness.
- **No stop conditions triggered.** Cache (87 MB, 780 SVGs) is under the OS
  tmpdir — gitignored, not committed (AD-3).

## Operational readiness

N/A — dev/test infrastructure; the browser library is untouched (all new code is
Node-only, under `test/corpus/`, never imported by `src/index.ts`). No SLIs,
dashboards (prod), traces, or on-call. **Rollback: Reversible** (additive; revert
the merge commit). The "dashboard" here is a parity report artifact, not a
production observability surface.
