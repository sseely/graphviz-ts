# Mission: Fix concentrate edge-merge trunk routing (corpus 2559)

## Objective

Corpus test **2559** (`concentrate=true`) is `diverged`. The concentrate merge
of `c->b` and `d->b` is *detected and executed correctly*, but the merged
**shared-trunk geometry is never routed** — the port draws each original edge
directly, while native draws `c->b` as a 2-segment trunk that `d->b` joins.
Port the C `spline_merge` trunk-routing branch so the merged virtual chain emits
the trunk, flipping 2559 `diverged → structural-match` with **zero survey
regressions**.

This is a minimal reproduction of a real merged-trunk routing gap that b69's
x-coord noise previously masked. See
`.agent-notes/2559-concentrate-merge-trunk-routing.md`.

## Branch

`fix/concentrate-2559` off clean `main`. Merge-commit on completion (per-task
commit IDs are referenced in the decision journal).

## Source of truth

- C spec: `~/git/graphviz/lib/dotgen/dotsplines.c` — `make_regular_edge`
  (≈1718-1873, `hackflag`/`spline_merge` path) and `spline_merge` (≈108).
- Probe evidence: `.agent-notes/2559-concentrate-merge-trunk-routing.md`.
- Decisions: [decisions.md](decisions.md).

## Constraints

**Stop conditions** (halt + log to decision-journal, wait for human):
- T1 finds the fix locus is **outside** `edge-route-chain.ts` /
  `splines-route.ts` / `edge-route-faithful.ts` (write-set assumption broken).
- Any change to `conc.ts` or `classify.ts` appears necessary — the merge is
  already correct; needing to touch it contradicts the investigation.
- `survey:gate` shows **any** regression that a fresh isolated 15.1.0 oracle
  confirms is real (not cache skew).
- Same routing approach changed 3× consecutively without converging.
- 2 consecutive quality-gate failures on the same check.

**Push-forward** (decide and log):
- Exact spline control points / minor structural shape, as long as the merged
  trunk is present and survey is green.
- Which of the ≤3 routing files actually needs the edit (T1 decides).
- Whether byte-match falls out naturally (pursue if free; not required — ADR-3).

## Quality gates

| command | pass | on_fail |
|---|---|---|
| `npx tsc --noEmit --stableTypeOrdering` | exit 0 | fix_and_rerun |
| `npx vitest run` | exit 0, new 2559 test green | fix_and_rerun |
| `npm run survey:setup && npm run survey` (fresh/isolated 15.1.0 cache) | 2559 → structural-match | fix_and_rerun |
| `npm run survey:gate` | regressions = 0 | stop |
| `git diff --name-only HEAD~1` | matches declared write-set only | stop |

## Batches

| Batch | Task | Status |
|---|---|---|
| 1 | [T1 — Pin the exact divergence point](batch-1/T1-investigate.md) | [ ] |
| 2 | [T2 — Faithful fix + golden + unit test (TDD)](batch-2/T2-fix-and-test.md) | [ ] |
| 3 | [T3 — Survey verification + comparison page](batch-3/T3-survey-verify.md) | [ ] |

## Index

- [decisions.md](decisions.md) — ADR-1/2/3 (approach, oracle, success bar)
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/data-flow.md](diagrams/data-flow.md) — merge → route → emit sequence
- [diagrams/component-map.md](diagrams/component-map.md) — touched components
- Batch overviews: [1](batch-1/overview.md) · [2](batch-2/overview.md) · [3](batch-3/overview.md)
- `comparisons/` — T1 findings + T3 survey verification (created during execution)
