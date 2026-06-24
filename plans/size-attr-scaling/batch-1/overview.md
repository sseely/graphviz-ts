<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — Empty-label-span guard

Independent quick win that also clears the `childCount` first-diff on the
`rankdir_dot*` cluster. Ships before the larger scaling work so the structural
fix is isolated in its own commit.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Guard `renderOneLabel` to skip empty-string spans (still advance the y baseline); add golden | sonnet | `src/gvc/device.ts`, `test/golden/inputs/dot-label-blank-lines.dot`, `test/golden/refs/dot-label-blank-lines.svg`, `test/golden/manifest.json` | — | [x] |

Gate after batch: `tsc --noEmit` clean, `vitest run` green (incl. the new
golden), `git diff --name-only main` ⊆ T1 write-set.
