<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 2 — `size=` drawing scaling

The mission core: parse `size=`/`filled`, compute the zoom `Z`
(`init_job_viewport`), and scale the SVG render. One agent owns the whole
parse→zoom→render chain to avoid a fragile `job.zoom` seam.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2 | Parse `size=`/filled + `init_job_viewport` zoom in `render()`; scale SVG `width`/`height`/`viewBox` + group `scale(Z)`; add golden | sonnet | `src/gvc/device.ts` (`render()`), `src/render/svg-graph.ts`, `test/golden/inputs/dot-size-scaling.dot`, `test/golden/refs/dot-size-scaling.svg`, `test/golden/manifest.json` | T1 | [x] |

Depends on T1 only for sequential ownership of `gvc/device.ts` (T1 edits
`renderOneLabel`, T2 edits `render()` — different functions, same file, so they
must not run concurrently).

Canary: the 6 `rankdir_dot*` corpus rows must reach **byte-match**.

Gate after batch: `tsc --noEmit` clean; `vitest run` green; **no byte change on
any input lacking `size=`** (spot-check 2-3 existing byte-match goldens);
`git diff --name-only main` ⊆ {T1, T2} write-sets.
