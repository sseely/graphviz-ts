<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — re-survey and regenerate the parity baseline

## Context

The committed baseline `test/corpus/parity.json` is generated with the **default
EstimateTextMeasurer** port + the **headless dot 15.1.0** oracle
(`GVBINDIR=/tmp/ghl`, built by `npm run survey:setup`). `parity.json` and
`parity-rules.json` are the same recipe — a locked-baseline / latest-run pair.
`rules-gate.ts` compares the latest run against the locked baseline; a
match→(diverged|errored) transition is a regression.

After T1, the survey emits `maxDeltaPath`. This task re-runs the survey to
populate it, proves the change is verdict-inert (gate = 0), then locks it in and
regenerates `PARITY.md`.

## Task (run in order; STOP on any gate regression)

1. **Setup oracle:** `npm run survey:setup` (builds `/tmp/ghl`; safe to re-run).
2. **Re-survey** into the run file (NOT `npm run survey` — `tsx` is not on PATH):
   ```
   GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json SURVEY_CONCURRENCY=3 \
     npx tsx test/corpus/survey.ts
   ```
   Concurrency 3 + a warm oracle cache avoids the under-load timeout flips that
   giants (2108, 1652) show at concurrency 8.
3. **Gate:** `npx tsx test/corpus/rules-gate.ts`. **Require `regressions=0`.**
   If nonzero → **STOP**, log the offending ids + the gate output to the decision
   journal, do not proceed. A regression means the additive field was not inert —
   diagnose before touching `parity.json`.
4. **Verify additive-only:** confirm the run's `structural-match` count is ~163
   and that `verdict`/`maxDelta` columns did not move vs the committed baseline
   (only `maxDeltaPath` should be new). A material structural-match count drift
   ⇒ stale cache / wrong recipe → **STOP**.
5. **Lock in:** `cp test/corpus/parity-rules.json test/corpus/parity.json`.
6. **Regen dashboard:** `npx tsx test/corpus/dashboard.ts` (writes `PARITY.md`).
7. **Sanity:** confirm the "Tracked structural-match — by worst-diff signature"
   table is now populated (buckets, not all `other-numeric`) and counts sum to
   the tracked structural-match total.

## Write-set

- `test/corpus/parity-rules.json`, `test/corpus/parity.json`, `test/corpus/PARITY.md`
  (all regenerated — never hand-edited).

## Read-set

- `README.md#background`, `decisions.md#stop-conditions`.
- `.agent-notes/` recipe notes if the survey misbehaves.

## Architecture decisions

- **Locked recipe:** EstimateTextMeasurer + `/tmp/ghl`. Do **not** use
  `survey:baseline` (LUT) or a non-ghl GVBINDIR — it clobbers the baseline.
- decisions.md#ad-2 (field is inert to the gate).

## Acceptance criteria

- **Given** T1+T2 merged, **when** the re-survey runs, **then**
  `rules-gate.ts` reports `regressions=0`.
- **Given** gate = 0, **when** the baseline is copied and the dashboard regen'd,
  **then** `parity.json` differs from the prior commit **only** by added
  `maxDeltaPath` keys (no verdict/maxDelta value changes).
- **Given** the regen, **when** `PARITY.md` is opened, **then** the new
  structural-match signature table is populated and its counts sum to the tracked
  structural-match total.

## Observability

N/A.

## Rollback

`git checkout -- test/corpus/parity.json test/corpus/parity-rules.json
test/corpus/PARITY.md` restores the prior baseline.

## Quality bar

`rules-gate.ts` = 0 regressions (hard gate). One commit:
`chore(T3): regenerate parity baseline with maxDeltaPath + structural buckets`.
