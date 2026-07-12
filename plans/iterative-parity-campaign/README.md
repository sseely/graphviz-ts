# Iterative-Engine Parity Campaign

## Objective

Attribute and resolve the neato/fdp/sfdp parity tails — 492/435/494 ids
diverged at ±0.5 tolerance per `test/corpus/parity-{neato,fdp,sfdp}.json`
(sweeps of 2026-07-11) — plus the JSON and imagemap emitter baselines
(`test/corpus/json-parity.json`, `test/corpus/map-parity.json`, gated on the
in-flight track builders). Completion bar is **D3**: every diverged id must
end in exactly one of `fixed` | `A1-drift-exonerated` (class) |
`irreducible-accepted` (per-id) | `named-open-mechanism` (tracked). Pass-rate
is a side effect, not the target — see `decisions.md#d3`.

Branch: `feature/xdot-conformance` (continue on it). Mission-brief branches
merge via **merge commit**, never squash, per
`~/.claude/rules/autonomous-execution.md` — squashing destroys the per-task
commit IDs this brief's decision journal references.

## Start here

1. Read `decisions.md` (six ADRs, D1–D6) — they are locked; cite by number.
2. Read this file's Batch table below for status.
3. Read the current batch's `overview.md`, then each task's `TN-*.md` —
   the task file **is** the agent prompt.

## Constraints

### Stop conditions
- A change would touch a file outside its task's declared write-set, and
  that file isn't in any other task's write-set either.
- Two consecutive quality-gate failures on the same check, or the same
  code location changed 3× consecutively without resolving the failure.
- A diagnosis result contradicts D1–D6.
- The native oracle is unstable beyond the documented modes (D6): a
  non-converging rebuild hash, or non-deterministic dumps that don't
  settle across 3 reruns.
- An acceptance is proposed for an id whose diff shape doesn't match the
  target class's signature (see D2).
- Any change to a shared primitive — `src/common/fma.ts`, the mt19937
  port, `textmeasure*`, `poly-sizing.ts` — has corpus-global blast radius
  and needs human sign-off before proceeding.

### Push-forward (no stop needed)
- A fix clears extra ids beyond its target — log the delta, keep going.
- A corpus id times out flakily — record it, exclude it, note it in the
  journal; don't block the batch on it.
- Bucket-ordering judgment calls within batch-3's round protocol.
- Docs/report wording.
- Re-running a sweep after a transient (non-mechanism) failure.

## Quality gates

| command | pass | on_fail |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | fix_and_rerun |
| `npx vitest run` | exit 0 (2964+ tests) | fix_and_rerun |
| `rm -f test/corpus/parity-<engine>.jsonl && GVBINDIR=/tmp/ghl npx tsx test/corpus/engine-walk.ts <engine>` (per touched engine; verify jsonl reaches 759 lines — retry-resume on silent bail) | 0 pass→diverged regressions vs the prior committed `parity-<engine>.json` | stop |
| `GVBINDIR=/tmp/ghl npx tsx test/corpus/survey.ts` (dot track — only when `src/common` or a shared primitive was touched) | 0 verdict regressions | stop |

Never edit main-tree `src/` while a sweep runs — sweeps read live source.
Resume-style sweeps skip once-passing ids and can hide regressions: always
run a **fresh** sweep (delete the `.jsonl` first) before committing any
routing change. Agents that instrument port code for diagnosis MUST run
inside a worktree (`EnterWorktree`), never the main tree.

## Batches

| # | Tasks | Status |
|---|---|---|
| B1 — injection harness + reporting infra | T1, T2, T3 | [ ] |
| B2 — per-engine attribution surveys | T4, T5, T6 | [ ] |
| B3 — repeating fix/accept rounds (loop until dry) | round 3a, 3b, … | [ ] |
| B4 — A1-drift class acceptances | T10 | [ ] |
| B5 — JSON/imagemap emitter tracks (gated) | T11, T12, T13 | [ ] |
| B6 — wrap: full gates, site deploy, summary | T14 | [ ] |

Links: `batch-1/overview.md`, `batch-2/overview.md`, `batch-3/overview.md`,
`batch-4/overview.md`, `batch-5/overview.md`, `batch-6/overview.md`.
Supporting docs: `decisions.md`, `decision-journal.md`,
`diagrams/component-map.md`, `diagrams/injection-recipe.md`.

## Summary (filled in at session end)

_Not yet started._
