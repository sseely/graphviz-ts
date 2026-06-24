<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — SVG rotation emit

Emit the rotation: `rotate(-job.rotation)` in the graph `<g>`, swap canvas W/H,
and the rotated translate. This is the visible change; b68 flips to byte-match.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | `emitGraphGroupOpen` rotate + `emitSvgTag` dim swap + rotated translate | single (sonnet) | `src/render/svg-graph.ts`, `src/render/svg-graph.test.ts` | T1 | [x] |

**Gate after batch:** typecheck + tests green; lizard clean; full survey diff vs
`/tmp/parity.before.json` → **0 regressions on non-landscape graphs, b68 →
byte-match**. NaN/proc3d may change maxDelta but must not enter a worse bucket.
