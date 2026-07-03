<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: structural-match equivalence-class buckets

## Objective

Categorize the **163 `structural-match`** corpus cases (identical SVG element
tree, numeric coordinate diffs above the ±0.01 deterministic tolerance) into
equivalence classes so groups can be driven to conformance. Two deliverables:

1. **Auto-regenerable dashboard sub-report** — a "Tracked structural-match — by
   signature" section in `PARITY.md`, produced by `dashboard.ts`, bucketing the
   163 by *worst-diff element-kind × magnitude band*. This requires the survey
   to first capture the **location** of the worst numeric diff (`maxDeltaPath`),
   which it currently discards.
2. **Mechanism-family analysis** — `analysis/README.md` mapping each bucket to a
   known root-cause family (LR_balance, ortho tie-break, hypot ULP, ltail
   pre-clip, per-rank spacing, xcoord-NS…) or flagging it novel, ranked by
   `count × tractability` as a prioritized list of candidate fix missions.

**This mission does not fix any divergence** — it is analysis + the tooling that
makes the analysis regenerable. (Mirrors dashboard.ts's own AD-5: triage ≠ fix.)

## Branch

`feature/structural-match-buckets` off `main`. Merge commit (not squash) —
per-task commit IDs are referenced in the decision journal.

## Background (why the section is a stub today)

- `diffVerdict` (`test/corpus/survey.ts:311`) keeps only `maxDelta` for a
  structural-match; `firstDiffPath` is populated **only** for `diverged`. Every
  structural-match row therefore has an empty `firstDiffPath` — the dashboard has
  no signal to cluster on, so the "Tracked structural-match" section is a stub.
- `divergedBucket()` (`dashboard.ts:55`) already buckets *diverged* cases by
  `firstDiffPath` shape. This mission adds the structural-match analogue.
- Baseline recipe: `parity.json` = **EstimateTextMeasurer + headless dot 15.1.0**
  (`GVBINDIR=/tmp/ghl`). Refresh = re-survey → `parity-rules.json`, gate
  regressions=0, `cp` → `parity.json`, regen dashboard. **Never** LUT / non-ghl.

## Known mechanism families (seed catalog for Batch 4)

Cross-reference each case against these already-diagnosed residuals (evidence in
`.agent-notes/` + auto-memory). Attribute or flag novel — do not re-diagnose.

| family | signature | ref |
|---|---|---|
| LR_balance degeneracy | x-coord NS feasible-tree state; node/edge x drift | 1447, 2239, 2475_2 |
| ltail/lhead pre-clip splines | edge `@d` near an endpoint clip | 1879 |
| ortho maze equal-cost tie-break | `splines=ortho` edge `@d` | 2361, 2620 |
| per-rank spacing | uniform y/x offset per rank | 1718 |
| hypot ULP (Apple libm) | ≤~10pt on one flat-edge arc | 2368 (A3, accepted) |
| xcoord-NS int-trunc | resolved-rank rounding | honda (done) |

## Constraints (stop / push-forward)

See `decisions.md#stop-conditions`. Load-bearing ones:
- **STOP** if `survey:gate` reports **any** regression after the re-survey — the
  tooling change must be inert to verdicts. Do not `cp` to `parity.json` until
  gate = 0.
- **STOP** if the `maxDeltaPath` change shifts any `verdict` or `maxDelta` value
  (it must be additive only).
- **PUSH FORWARD** on bucket taxonomy naming and analysis prose — stylistic.

## Quality gates (run between every batch)

```
- command: npm run typecheck
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run test/corpus/survey.test.ts
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx tsx test/corpus/rules-gate.ts   # after Batch 3 only
  pass: regressions=0 (exit 0)
  on_fail: stop
- command: git diff --name-only HEAD~1
  pass: matches the batch's declared write-set only
  on_fail: stop
```

## Batches

| batch | goal | tasks | done |
|---|---|---|---|
| [1](batch-1/overview.md) | Capture worst-diff location in the survey | T1 | [ ] |
| [2](batch-2/overview.md) | Dashboard structural-match bucket section | T2 | [ ] |
| [3](batch-3/overview.md) | Re-survey + regenerate baseline/PARITY.md | T3 | [ ] |
| [4](batch-4/overview.md) | Parallel per-bucket mechanism diagnosis | T4 (fan-out) | [ ] |
| [5](batch-5/overview.md) | Synthesize ranked candidate-mission list | T5 | [ ] |

Batches are sequential (each depends on the prior). Batch 4 fans out one agent
per element-kind bucket, discovered at runtime from the Batch 3 output.

## Docs

- [decisions.md](decisions.md) — architecture decisions + stop conditions
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/data-flow.md](diagrams/data-flow.md) — survey→dashboard→analysis flow
- [diagrams/component-map.md](diagrams/component-map.md) — touched components

## Operational readiness

**N/A** — dev/test tooling only. No runtime service, API, schema, or data model;
no SLIs, alerting, on-call, or backwards-compat surface. Every change is
**reversible** by `git revert` + `npx tsx test/corpus/dashboard.ts` regen. The
only external dependency is the native `dot` oracle (already cached).
