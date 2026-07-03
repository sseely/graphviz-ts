<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — structural-match bucket section in dashboard.ts

## Context

`test/corpus/dashboard.ts` reads `parity.json` and writes `PARITY.md`. It already
buckets **diverged** cases: `divergedBucket(path)` (dashboard.ts:55) maps a
`firstDiffPath` shape → `{ key, hypothesis }`, and `bucketize()` (:114) groups a
result list, sorted by count desc, rendered by `bucketTable()` (:129).

The "Tracked structural-match (159)" section (built in `buildMarkdown`, :262) is
currently a **stub** — heading + description, no listing — because structural-
match rows had no location signal. After T1, they carry `maxDeltaPath`.

## Task

Add a structural-match bucket taxonomy and a new report section.

1. **`structuralKind(path)`** — map a `maxDeltaPath` to an element kind:
   - ends `@d` → `edge-path` (spline/curve routing)
   - ends `@points` → `polygon-points` (node-shape or arrowhead geometry)
   - ends `@cx` or `@cy` (or `@rx`/`@ry`) → `node-ellipse` (node position/size)
   - ends `@x` / `@y` / contains `@transform` / `text` → `text-position` (label placement)
   - ends `@width` / `@height` / contains `viewBox` → `canvas-extent`
   - else → `other-numeric`
2. **`magnitudeBand(d)`** — `1–10` / `10–100` / `100–1000` / `>1000`
   (0 sub-pixel cases exist; guard `<1` → `<1` for safety).
3. **`structuralBucket(r)`** → `{ key: `${kind} · Δ${band}`, hypothesis }` with a
   one-line mechanism hint per kind (e.g. edge-path → "spline routing residual —
   x-coord/NS placement or clip endpoint"; node-ellipse → "node x-coord (NS/
   LR_balance) placement drift"). Reuse the existing `bucketize()` + `bucketTable()`.
4. **Render** a new section under the "Tracked structural-match" heading:
   `bucketTable('tracked structural-match — by worst-diff signature',
   bucketize(trackedStructural, structuralBucket))`. Keep the existing prose; the
   table goes directly beneath it. `trackedStructural` already exists (:232).
5. Also emit a compact **worst-first roster** (id · maxΔ · kind) capped like
   `DIVERGED_TABLE_CAP`, so a reader can jump from a bucket to concrete ids.
   Reuse/parameterize `divergedTable` or add a small sibling — do not duplicate
   the cap constant.

## Write-set

- `test/corpus/dashboard.ts` — new functions + one section wiring. No other file.

## Read-set

- `test/corpus/dashboard.ts:54-135` (divergedBucket/bucketize/bucketTable),
  `:137-146` (divergedTable), `:209-291` (buildMarkdown, esp. :220-232, :262-267).
- `test/corpus/survey.ts` SurveyResult (the `maxDeltaPath` field from T1).

## Architecture decisions

- decisions.md#ad-1 (element-kind × magnitude), #ad-3 (no compare.ts change).
- **Locked:** classify from `maxDeltaPath` only — do not read SVGs or add I/O in
  dashboard.ts (it must stay a pure parity.json → markdown transform).
- Opus/agent note: do **not** invent a semantic edge/node/cluster classifier
  here — that is Batch 4's job against the SVGs. Element-kind coarse is correct.

## Interface contract

Consumes `SurveyResult.maxDeltaPath?: string` (T1). A row with an undefined
`maxDeltaPath` (should not occur for structural-match post-T1) buckets as
`other-numeric · Δ?` — handle gracefully, do not throw.

## Acceptance criteria

- **Given** the current `parity.json` (pre-Batch-3, `maxDeltaPath` absent),
  **when** `npx tsx test/corpus/dashboard.ts` runs, **then** it exits 0 and the
  new section renders (all rows fall in `other-numeric` — acceptable until re-survey).
- **Given** a `parity.json` where structural-match rows carry `maxDeltaPath`,
  **when** the dashboard runs, **then** the new table lists buckets keyed by
  `kind · Δband`, counts summing to `trackedStructural.length`, sorted by count desc.
- **Given** the change, **when** `npm run typecheck` runs, **then** exit 0.

## Observability

N/A.

## Rollback

Reversible — `git revert` + rerun dashboard.

## Quality bar

`npm run typecheck` = 0; `npx tsx test/corpus/dashboard.ts` exits 0 against the
current `parity.json`. Do not hand-edit `PARITY.md` (generated). One commit:
`feat(T2): bucket structural-match by worst-diff signature in dashboard`.
