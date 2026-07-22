<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Foundations (code + toolchain)

Four independent tasks with disjoint write-sets — run in parallel. Nothing
here depends on another Batch-1 task. Batch 2 content pages (T7, T11) depend
on T1's API surface; Batch 3 (T12) depends on T3's reference path.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Image embed API: `setImageResolver` + `render({ inlineImages })`, browser-safe base64, tests | typescript-pro (Sonnet, high) | `src/gvc/image-resolver.ts`(+`.test.ts`), `src/render/svg.ts`, `src/render/public.ts`, `src/gvc/device.ts`, `src/index.ts` | — | [x] ef6cf8f |
| T2 | Gitlab test-links + local-path scrub in dashboards; shared helper + test | typescript-pro (Sonnet) | `test/corpus/corpus-links.ts`(+`.test.ts`), `parity-report.ts`, `dashboard.ts`, `json-dashboard.ts`, `map-dashboard.ts`, `xdot-dashboard.ts` | — | [x] 28946af |
| T3 | TypeDoc → markdown toolchain wired into VitePress | documentation-engineer (Sonnet) | `package.json`, `typedoc.json`(new), `.gitignore` | — | [x] 588f399 |
| T4 | TSDoc gap-fill on public surface | typescript-pro (Sonnet) | `src/api/edge-ops.ts`, `src/render/xdot-public.ts`, `src/api/index.ts`, `src/render/index.ts` | — | [x] d3d2f93 |

## Write-set conflict check

- T1 owns `src/render/public.ts` and `src/index.ts`. T4 owns
  `src/render/index.ts` and `src/api/index.ts` — **no overlap**.
- T3 owns `package.json`/`.gitignore`; no other Batch-1 task writes them.
- Confirm before launch: `git diff --name-only` after each agent stays within
  its row above.

## Gate after batch

`npm run typecheck && npm test && npm run build`. (T3's `docs:build` is
exercised in Batch 3 once pages exist; a smoke `npm run docs:api` is enough
here to confirm TypeDoc emits.)
