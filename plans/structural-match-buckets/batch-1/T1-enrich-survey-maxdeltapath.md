<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — record `maxDeltaPath` in the survey

## Context

`graphviz-ts` is a faithful TypeScript port of Graphviz. `test/corpus/survey.ts`
is Node-only dev/test infra: it renders each corpus input through the native
`dot` oracle and the port, diffs the two SVGs with `compareSvg`, and writes
`parity.json`. `dashboard.ts` reads that and writes `PARITY.md`.

`compareSvg(port, oracle, 'deterministic')` returns `diffs: Diff[]` where
`Diff = { path: string; actual; expected; delta?: number; tolerance? }`. A
**structural-match** is: ≥1 numeric diff (`delta !== undefined`), 0 structural
diffs (`delta === undefined`). Today `diffVerdict` reduces the numeric diffs to a
scalar `maxDelta` and **discards the path of that worst diff** — so structural-
match rows have an empty `firstDiffPath` and cannot be bucketed.

## Task

In `test/corpus/survey.ts`, make `diffVerdict` also record the **path of the
worst numeric diff** as a new additive field `maxDeltaPath`.

1. Add `maxDeltaPath?: string;` to the `SurveyResult` interface (near
   `firstDiffPath`, with a one-line JSDoc: "XPath of the worst numeric diff — the
   location `maxDelta` occurs at; the structural-match bucket key. @see dashboard").
2. In `diffVerdict` (survey.ts:311), replace the scalar `maxDelta` reduce with a
   single pass that tracks both the max delta **and its path** over `numeric`.
   Deterministic tie-break: keep the **first-encountered** max (strict `>` when
   scanning in array order — do not overwrite on ties). Return `maxDeltaPath` on
   **both** the `diverged` branch (alongside the existing `firstDiffPath`) and the
   `structural-match` branch.
3. Do not change the `verdict` logic, the `maxDelta` numeric value, or
   `firstDiffPath`. The field is purely additive.

## Write-set

- `test/corpus/survey.ts` — interface field + `diffVerdict` body only.
- `test/corpus/survey.test.ts` — add one assertion (below).

## Read-set

- `test/corpus/survey.ts:108-123` (SurveyResult), `:310-327` (diffVerdict).
- `test/golden/compare.ts:32-40` (Diff shape).
- `test/corpus/survey.test.ts` — match the existing test style for a
  structural-match fixture; reuse any helper that builds port/oracle SVG pairs.

## Architecture decisions

- decisions.md#ad-2 (additive field, durable), #ad-4 (max diff, first-wins tie).
- **Locked:** do not touch `test/golden/compare.ts` (decisions.md#ad-3). Do not
  change verdict/maxDelta/firstDiffPath. Do NOT infer extra requirements — this is
  the minimal additive change; no new traversal, no class resolution.

## Interface contract (consumed by T2)

```ts
interface SurveyResult {
  // …existing…
  maxDelta?: number;
  firstDiffPath?: string;   // diverged only (unchanged)
  maxDeltaPath?: string;    // NEW: path of the worst numeric diff; set for
                            // both diverged and structural-match. undefined
                            // only when there are no numeric diffs.
}
```

## Acceptance criteria

- **Given** a port/oracle SVG pair differing only numerically with the largest
  delta on some attribute path P, **when** `diffVerdict` runs, **then** the result
  is `structural-match` with `maxDeltaPath === P` and `maxDelta` equal to that
  delta.
- **Given** two numeric diffs tied on the max delta, **when** `diffVerdict` runs,
  **then** `maxDeltaPath` is the path of the **first** in compareSvg walk order.
- **Given** a conformant pair, **when** `diffVerdict` runs, **then**
  `maxDeltaPath` is `undefined` (verdict `conformant`, no diffs).
- **Given** the change, **when** `npm run typecheck` and
  `npx vitest run test/corpus/survey.test.ts` run, **then** both exit 0.

## Observability

N/A — no new observable runtime operation (dev/test infra).

## Rollback

Reversible — additive field; `git revert` restores prior behavior.

## Quality bar

`npm run typecheck` = 0; `npx vitest run test/corpus/survey.test.ts` = 0.
Return only the diff summary. One commit: `feat(T1): record maxDeltaPath in
survey diffVerdict`.
