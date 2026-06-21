<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. One row per non-trivial judgment call.

| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-20 | setup | Branched `fix/rounded-clusters-mrecord` off `docs/rounded-brief` (= main + the brief commit, no code) rather than bare `main` | The brief lives only on docs/rounded-brief; branching there keeps plans/ tracked while staying code-equivalent to main. Merge to main brings brief + impl. |
| 2026-06-20 | T1 | AD-1 helper `emitRoundedBezier(ring, coord, filled, ctx)` placed in `poly-shapes.ts` (exported); `roundedDraw` now delegates to it | poly-shapes-util.ts is outside the write-set; helper must live in poly-shapes.ts. Body is byte-identical to the old roundedDraw, so poly nodes unchanged (AC5 byte-gate locks it). |
| 2026-06-20 | T1 | Record outer box keeps `filled=false` for BOTH the rounded and polygon branches | The port's pre-mission record box was always `polygon(pts,false)`; C resolves node fill but the port has no record-fill path. Matching `false` is zero-regression and correct for the unfilled golden Mrecord. Record fill resolution is a separate pre-existing gap, out of scope (AD-4 rendering-only). |
| 2026-06-20 | T1 | Record SPECIAL_CORNERS gated on `rounded` only (Mrecord-forced OR style=rounded), not diagonals/shape | For records `style.shape`==0 always and `style=diagonals` on a record is unconstructible in practice; gating on rounded leaves every non-rounded record byte-identical (zero regression) while covering all ACs. |
| 2026-06-20 | T1 | Extracted `renderClusterBox` (device.ts) and `drawRecordBox` (record.ts); removed a stale duplicate JSDoc block above renderOneCluster | Inlining the rounded branch pushed renderOneCluster/recordGencode over the complexity-hook length cap (30); helpers keep each ≤ cap. The stale `AC12` JSDoc was orphaned by the insertion and inflated walkNodesAndEdges' attributed length. |
| 2026-06-20 | T1 | Gates: vitest 2041 pass, tsc --noEmit clean, complexity clean; repros (rounded cluster, filled cluster, Mrecord) geometry byte-matches oracle; control box <path> unchanged | Batch-1 quality gate satisfied. LSP workspace flooded stale "no exported member" diagnostics during edits; tsc --noEmit (project config) is authoritative and clean. |
