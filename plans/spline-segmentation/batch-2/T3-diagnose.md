# T3 — Pick + diagnose an issue-numbered routing case

## Context
Same mission as Batch 1. The `path-structure` bucket's larger set is
routing-POSITION divergences. Many corpus inputs are named after a graphviz
GitLab issue (`NNNN.dot`); the issue + closing MR explain the intended routing
behavior (memory: `issue-numbered-tests-consult-pr`).

## Task
`Select` the most isolated issue-numbered `path-structure` `diverged` case,
`recover` its intent from the issue + MR, and `identify` the exact port routing
divergence — before any fix. Do NOT edit `src/`.

1. From `test/corpus/parity.json`, list `diverged` ids with `firstDiffPath`
   ending `@d` whose id is numeric; sort by `maxDelta`. Pick a small, isolated
   one (prefer a single divergent edge).
2. Recover intent: `git -C ~/git/graphviz log --all --grep '<num>'` and
   `... log --all -- tests/<file>`; read the closing MR's diff/message; if
   network is available, WebFetch `gitlab.com/graphviz/graphviz/-/issues/<num>`.
   Summarize the intended behavior in one line.
3. Instrument C (same recipe as T1) to dump the oracle's routed spline for the
   divergent edge; dump the port's; locate the divergent port function.

## Write-set
- `plans/spline-segmentation/decision-journal.md` (append findings).
- Never edit `src/` in T3.

## Read-set
- `test/corpus/parity.json`; the chosen input.
- C: `~/git/graphviz/lib/dotgen/dotsplines.c`, `lib/pathplan/`, + the MR diff.
- Port: `src/layout/dot/edge-route-*.ts`, `splines-route.ts`.
- `decisions.md#ad-4` (issue+MR recovery), `#ad-2` (instrument first).

## Interface contract (consumed by T4)
`{ issueNum, issueIntent, divergentFn (file:line), cRef, rootCause }`.

## Acceptance criteria (Given/When/Then)
- **Given** the survey, **when** filtered, **then** one isolated issue-numbered
  case is chosen with its `maxDelta` and id recorded.
- **Given** the issue number, **when** the git history / MR is read, **then** the
  intended routing behavior is summarized in ≤2 lines.
- **Given** C + port dumps, **then** the divergent port function is named with
  `file:line` and a one-line root cause.
- **Given** the findings, **when** T3 ends, **then** T4 can scope its fix without
  further diagnosis.

## Observability
N/A — diagnostic.

## Rollback notes
Reversible — plan-doc append only.

## Boundaries
- **Always:** read the issue/MR before hypothesizing; dump real C values.
- **Never:** edit `src/`; pick a case needing a layout-phase rewrite (out of scope).
- **STOP:** if no isolated issue-numbered case exists, or the case needs deep
  multi-cause layout work → report and end.

## Commit
`docs(T3): diagnose issue-#<num> dot routing divergence`.

## Quality bar
No `src/` change. Return only the structured findings.
