<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 3 — Integration

One task: wire everything into a coherent, React/Angular-style site. It is the
**sole writer** of the shared navigation/landing files, so it must run after
Batches 1–2 (it links pages T3/T5–T11 created).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T12 | IA overhaul: sidebar restructure, landing redesign, getting-started orientation | frontend-developer or documentation-engineer (Sonnet) | `docs-site/.vitepress/config.ts`, `docs-site/index.md`, `docs-site/guide/getting-started.md` | T3, T5–T11 | [x] 03e6ea2 |

## Final quality gates (after T12)

Run the full set from the mission README:
```
npm run typecheck
npm test
npm run build
npm run docs:build      # copy-reports (T2 scrubbed) + typedoc (T3) + vitepress
```
Plus:
- `grep -rl "/Users/" docs-site/parity-*.md` → **no matches** (T2 verification).
- `git diff --name-only <mission-base>` matches the union of all task write-sets
  (+ regenerated, gitignored artifacts only).
- Manually spot-check the built site nav renders the three groups and the
  generated Reference section resolves.
