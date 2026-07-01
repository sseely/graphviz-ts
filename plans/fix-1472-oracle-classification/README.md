# Mission: fix 1472 — classify malformed-oracle inputs as `oracle-error`

## Objective

parity.json marks `1472` as `diverged / <compare-threw>`
(`Opening and ending tag mismatch: "svg" != "g"`). Diagnosis proved this is a
**false attribution to the port**: the port renders `tests/1472.dot` cleanly to
well-formed SVG, but the **native oracle** emits *invalid XML* (the input's
invalid UTF-8 bytes propagate into native's output). `compareSvg` throws while
normalizing the oracle; `diffVerdict` blankets the throw as `diverged`. This
mission fixes the survey harness so a non-well-formed oracle is classified as
`oracle-error` (the existing "oracle unusable" bucket, excluded from port
scoring) — the same class as the already-quarantined malformed fuzz inputs.

**No `src/` change.** Upstream #1472's real bug (adjacency-matrix buffer
overflow; sparse-matrix fix `a259a6a8d`) is already ported
(`mincross-utils.ts:50-90`). The port does not crash and needs no layout/emit
change. This is a test-harness classification fix.

## Evidence (verified)

| Renderer | 1472.dot | Well-formed XML? |
|---|---|---|
| brew graphviz 15.0.0 (Pango) | 101,974 B | ❌ `svg != g` |
| dev graphviz 15.1.0 (oracle) | 102,071 B | ❌ `svg != g` |
| graphviz-ts port | 90,591 B, exit 0 | ✅ parses OK |

Both native versions emit invalid XML; the brew output even has a closing
`</svg>` yet is still not well-formed — which is why the current
`</svg>`-completeness check (survey.ts:217) misses it. Only 1 `<compare-threw>`
case exists in the 789-entry corpus (1472); the fix generalizes to any future
malformed-oracle input.

## Branch

`fix/1472-oracle-classification` (branch from `main`).

## Constraints

**Stop conditions**
- Any file outside the declared write-set needs changing.
- Two consecutive quality-gate failures on the same check.
- The harness fix would reclassify any case *other than* 1472 to
  `oracle-error` (would indicate it is masking a real port-side parse failure —
  investigate before proceeding).
- `npm run survey:gate` fails after the baseline refresh.

**Push-forward (decide and log)**
- Exact wording of comments / error-message text.
- Placement of the `isWellFormedSvg` helper within survey.ts.
- Test fixture SVG strings, provided they exercise valid + `svg!=g` cases.

## Architecture decision

Confirmed with user: **harness fix at the oracle-usability site** (survey.ts
`surveyOne`), not a per-file quarantine. Rationale + rejected options in
[decisions.md](decisions.md).

## Quality gates

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run test/corpus/survey.test.ts
  pass: exit 0 (new isWellFormedSvg tests green)
  on_fail: fix_and_rerun
- command: npm run survey && npm run survey:gate
  pass: exit 0; 1472 verdict == oracle-error; no OTHER id changes bucket
  on_fail: stop
- command: git diff --name-only
  pass: only test/corpus/survey.ts, test/corpus/survey.test.ts,
        test/corpus/parity.json, test/corpus/parity-rules.json,
        docs/parity artifacts, plans/**, .agent-notes/**
  on_fail: stop
```

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — harness fix + baseline refresh | [x] | [batch-1/overview.md](batch-1/overview.md) |

## Index

- [decisions.md](decisions.md) — architecture decision + rejected options
- [batch-1/overview.md](batch-1/overview.md) — task table
- [batch-1/T1-oracle-wellformed-classification.md](batch-1/T1-oracle-wellformed-classification.md)
- [batch-1/T2-regenerate-parity-baseline.md](batch-1/T2-regenerate-parity-baseline.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) — verdict decision flow
- [decision-journal.md](decision-journal.md)
- Prior diagnosis: `.agent-notes/1472-oracle-invalid-xml.md`

## Session summary (complete)

**Status: DONE.** Batch 1 complete; all tasks `[x]`; all quality gates PASS.

- **T1** (`9c2a630`) — added exported `isWellFormedSvg(svg)` (wraps `normalizeSvg`
  in try/catch) to `test/corpus/survey.ts`; `surveyOne` short-circuits to
  `oracle-error` (msg `oracle not well-formed XML: <N>B`, PII-free) when the
  oracle fails to parse, before the port render. TDD: 3 unit tests in
  `test/corpus/survey.test.ts` (well-formed→true, `<svg><g></svg>`→false,
  empty→false).
- **T2** (`1765e8e`) — regenerated `parity-rules.json`/`parity.json` + `PARITY.md`
  via the frozen recipe (headless `/tmp/ghl` + Estimate measurer).

**Gate results**
- `tsc --noEmit`: exit 0.
- `vitest run test/corpus/survey.test.ts`: 3/3 green.
- `survey:gate`: PASS — 0 rules regressions, 0 clip regressions.
- Per-id delta: **exactly one** id changed verdict — `1472` diverged→oracle-error;
  0 maxDelta drift vs committed baseline. Counts diverged 33→32, oracle-error
  11→12 (as predicted in AD-1).
- Write-set: 5 tracked files (`survey.ts`, `survey.test.ts`, `parity.json`,
  `parity-rules.json`, `PARITY.md`) — no `src/` change. 2 commits (one per task).

**Follow-up (non-blocking):** committed `PARITY.md` was stale relative to its own
`parity.json` (2471/1879 numbers); the T2 dashboard regen corrected it. Unrelated
to this fix — surfaced only because the dashboard is a pure function of
`parity.json`.

**Merge:** use a merge commit (mission branch) to preserve T1/T2 commit IDs.
Branch cleanup is batched by the user, not per-mission.
