<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — landscape flag → job.rotation (byte-stable)

Pure plumbing: detect landscape and set `job.rotation = 90`, guard
`transformPoint` against double-rotation. No visible output change — the SVG
transform still emits `rotate(0)` until T2. Establishes the interface T2 reads.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Parse rotate/orientation/landscape → `job.rotation`; guard transformPoint | single (sonnet) | `src/gvc/viewport.ts`, `src/gvc/device.ts`, `src/gvc/device.test.ts` | — | [x] |

**Gate after batch:** `npm run typecheck` + `npm test` green; survey output
**byte-identical** to `/tmp/parity.before.json` (T1 changes no rendered bytes).
