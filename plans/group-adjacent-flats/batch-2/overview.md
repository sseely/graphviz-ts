# Batch 2 — Implement grouping (green) + regression sweep

Two sequential tasks. T2 implements the caller-side grouping to turn T1's red
test green. T3 runs the full regression gate (the golden-risk guard the prior 4
missions feared). T3 depends on T2.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Caller-side adjacent-flat grouping in the dispatch; turn the red test green | (orchestrator or backend/debugger) | `src/layout/dot/edge-route.ts` (+ a small helper if needed under `src/layout/dot/`) | T1 | [ ] |
| T3 | Full regression: goldens byte-identical out-of-family + corpus survey net-improve; record per-id verdict deltas | debugger | `plans/group-adjacent-flats/findings-regression.md` | T2 | [ ] |

T2 touches the layout path — single writer, no parallel edits to `edge-route.ts`.

## T2 — implement grouping
- Insert grouping at the most surgical point (AD-2): when `routeFaithfulSidePort`
  (or `routeForwardEdge`) is about to call `makeFlatAdjEdges(g, [e], 1, et)` for
  an adjacent same-rank side-port edge, instead collect the full group — all
  unrouted adjacent-flat port-bearing edges with the same unordered `{tail,head}`
  pair (both directions + parallels) — order it per T1's comparator (forward /
  min-seq first), and call `makeFlatAdjEdges(g, group, group.length, et)` ONCE.
- Idempotency: build/route each group exactly once. The existing
  `if (e.info.spl !== undefined) continue` in `routeDotEdges` (`edge-route.ts:336`)
  must skip the remaining members after the group routes (verify `copyFlatSplines`
  sets `spl` on every member — it iterates `edges[]` via `aux.alg`).
- Do NOT change `makeSimpleFlat`, labeled-flat, or non-adjacent dispatch (AD-3).
- Keep each changed function ≤30 lines / CCN ≤10 (lizard); extract a small
  `collectAdjacentFlatGroup` helper if needed (same file or a sibling under
  `src/layout/dot/`).
- Gate: T1's `splines-flat-group.test.ts` goes GREEN; `npx tsc --noEmit` exit 0.

## T3 — regression sweep (AD-4)
- `npx vitest run`: 0 failures; every curated golden BYTE-IDENTICAL except the
  intended `#241_0` adjacent-flat family. Any out-of-family flip ⇒ STOP.
- `npx tsx test/corpus/survey.ts`: `#241_0` verdict moves `diverged`→matches (or
  strictly smaller maxDelta) AND zero NEW `diverged` verdicts corpus-wide. Record
  the per-id verdict delta table (memory `bucket-fix-rebucketing`: judge by
  per-id deltas, not bucket counts).
- If any golden in the `#241_0` family changes, its before/after oracle
  comparison is recorded in `findings-regression.md` (CLAUDE.md: a changed case
  is not "done" until its comparison is referenced).
- `lizard` on changed files clean. C oracle cache restored native (AD-5).

Exit criteria for the batch:
- T1's red test is green; goldens byte-identical out-of-family; corpus survey
  net-improves with zero new diverges; `#241_0` residual closed (or the precise
  residual that remains is documented with its oracle delta).
