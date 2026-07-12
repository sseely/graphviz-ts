# Batch 5 — JSON/Imagemap Emitter Tracks

**Gated**: this batch depends on artifacts from the JSON output parity
track and the imagemap (cmapx+imap) parity track, both in flight as of
2026-07-11 evening (separate work, tracked outside this brief). Do not
start T11/T12 until their baseline artifacts exist:

- JSON track → `test/corpus/json-parity.json` + `PARITY-JSON.md`
- Imagemap track → `test/corpus/map-parity.json` + `PARITY-MAP.md`

Check for these files at the start of batch-5; if either is missing,
that half of the batch is blocked (not a stop condition — just wait
for the other track to merge, or work the unblocked half first).

## Tasks

| Task | Subject | Gated on |
|---|---|---|
| T11 | JSON emitter fixes | `test/corpus/json-parity.json`, `PARITY-JSON.md` |
| T12 | Imagemap emitter fixes | `test/corpus/map-parity.json`, `PARITY-MAP.md` |
| T13 | Emitter acceptances (wires residuals from T11+T12) | T11, T12 |

T11 and T12 write disjoint files (`src/render/json.ts` vs
`src/render/map.ts`) — run in parallel once both baselines exist. T13
depends on both.

## Exit criteria

- Every baseline divergence bucket from `json-parity.json` and
  `map-parity.json` is either fixed (re-survey clean) or documented +
  accepted via `accepted-divergences-{json,map}.json` with prose.
- Both emitter tracks' residuals are wired into the standard report
  flow by T13.
