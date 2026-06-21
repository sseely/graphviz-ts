# Mission: Parity low-hanging fruit

## Objective

Improve dot-corpus parity by clearing the **simplest** divergences first. Triage
the 62 cases in the five smallest buckets (color-stroke, text-content,
attr-or-tag, polygon-points, parser-gap), fix every case with a localized,
oracle-pinned root cause (≤~30 lines, single module, faithful to C), and defer
the deep ones with a comparison page. Success = byte-match increases with **0
per-id regressions**. The two heavy buckets (`path-structure` 158,
`element-count` 109) are explicitly out of scope.

One verified seed fix anchors Batch 2: hex colors are emitted verbatim
(`#1E1E1E`) where graphviz lowercases (`#1e1e1e`) — a one-spot normalization in
`src/render/color-resolve.ts`.

## Branch

`feature/parity-low-hanging-fruit` — merge commit (one commit per fix group /
task, referenced in the decision journal). Do NOT squash.

## Constraints

### Stop conditions
- STOP if a fix needs changes outside its task write-set not owned by another task.
- STOP on 2 consecutive quality-gate failures on the same check, or 3 consecutive
  fixes to the same location for the same case.
- STOP if a "simple" case turns out to require layout/routing changes, a new shape
  port, or charset/encoding infrastructure — reclassify as **deep**, defer with a
  comparison page, do NOT expand scope.
- STOP if a fix causes ANY per-id regression that cannot be resolved within the
  same task (per the "bucket-fix re-bucketing" rule: judge by per-id verdict
  deltas, not aggregate counts).
- STOP if the oracle (native `dot`) is unavailable or its output is unstable.

### Push forward
- Grouping cases by shared root cause; choosing the representative golden per group.
- Wording of triage docs / comparison pages.
- Deferring a case to **deep** when the fix exceeds the simple cutoff (log it).

## Quality gates (run between every batch)

```
- command: npm run typecheck      # pass: exit 0
- command: npm test               # pass: exit 0 (incl. golden suite)
- command: npm run build          # pass: exit 0
- command: git diff --name-only   # pass: matches the batch write-set only
```

Oracle: native `dot` 15.1.0 at `~/git/graphviz/build/cmd/dot/dot`,
`GVBINDIR=/tmp/gvplugins`, corpus at `~/git/graphviz/tests`. Never approximate —
validate against the spawned native binary (see memory: "Oracle: native not WASM").

## Architecture decisions

See [decisions.md](decisions.md). Summary: triage read-only + oracle-pinned
(ADR-1); fixes grouped by shared root cause, one commit per group (ADR-2);
simple ≤~30 lines/single-module else deep+comparison-page (ADR-3); one golden per
root-cause group (ADR-4); Latin1/Symbol charset presumed deep (ADR-5); parity
regeneration is the success metric (ADR-6).

## Batches

| Batch | Theme | Tasks | Status |
|-------|-------|-------|--------|
| [1](batch-1/overview.md) | Triage (parallel, read-only) | T1 color-stroke, T2 text-content, T3a/T3b attr-or-tag, T4 polygon-points, T5 parser-gap | [ ] |
| [2](batch-2/overview.md) | Fixes (sequential) | T6 color, T7 text, T8 attr, T9 polygon, T10 parser | [ ] |
| [3](batch-3/overview.md) | Regenerate + finalize | T11 survey/dashboard, 0-regression check, comparison pages, memory | [ ] |

## Diagrams

- [data-flow.md](diagrams/data-flow.md) — triage → fix → regenerate loop
- [component-map.md](diagrams/component-map.md) — buckets over the render/parse modules

## Decision journal

Appended during execution: [decision-journal.md](decision-journal.md).
