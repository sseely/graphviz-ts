<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — TypeDoc → markdown toolchain wired into VitePress

## Context

The site is VitePress (`docs-site/`) with hand-authored guides and local
MiniSearch search. We want an auto-generated API reference that lives **inside**
the same site (shared theme + search), generated from the public TSDoc.
See [decisions.md#typedoc](../decisions.md#typedoc).

Public entry points and their barrels:
- `graphviz-ts` → `src/index.ts`
- `graphviz-ts/api` → `src/api/index.ts`
- `graphviz-ts/render` → `src/render/index.ts`

## Task

1. **devDependencies** in `package.json`: `typedoc` and
   `typedoc-plugin-markdown` (compatible pinned minor versions). Optionally
   `typedoc-vitepress-theme` if it cleanly emits a VitePress sidebar fragment —
   otherwise skip it and let T12 hand-author the sidebar entries.
2. **`typedoc.json`** (new, repo root):
   - `entryPoints`: the three barrels above; `entryPointStrategy: "expand"` or
     explicit list. Use the build tsconfig (`tsconfig.build.json`).
   - `plugin: ["typedoc-plugin-markdown"]`, `out: "docs-site/reference"`.
   - `readme: "none"`, `githubPages: false`, `excludeInternal: true`,
     `excludePrivate: true`. Only the public surface — do not document
     internal `model/`, `layout/`, etc. (they are not re-exported).
   - Markdown options tuned for VitePress (hide breadcrumbs page title dup as
     needed; keep output clean).
3. **`package.json` scripts:**
   - `"docs:api": "typedoc"`.
   - Wire it into the docs build **before** VitePress:
     `"docs:build": "npm run docs:copy-reports && npm run docs:api && vitepress build docs-site"` and the same insertion for `docs:dev`
     (`… && npm run docs:api && vitepress dev docs-site`).
4. **`.gitignore`:** add `docs-site/reference/` (generated, never committed).
5. **Smoke test:** run `npm run docs:api` and confirm it emits `.md` under
   `docs-site/reference/` for all three entry points with the public symbols
   (`renderSvg`, `parse`, `createGraph`, `addEdge`, `getLayout`, `render`,
   `getDrawOps`, `setImageSizer`, and — if T1 landed first — `setImageResolver`).
   T1 and T3 are independent; if `setImageResolver` isn't present yet at smoke
   time, that's fine — the reference regenerates in Batch 3.

## Read-set

- `package.json` (scripts, exports, files)
- `tsconfig.build.json`
- `src/index.ts`, `src/api/index.ts`, `src/render/index.ts` (entry barrels)
- `docs-site/copy-reports.mjs` (build ordering context)
- `docs-site/.vitepress/config.ts` (sidebar shape — do **not** edit; T12 owns it)
- [decisions.md#typedoc](../decisions.md#typedoc)

## Interface contract (output — consumed by T12)

Generated markdown exists at `docs-site/reference/**` after `npm run docs:api`.
T12 links a "Reference (generated)" sidebar group to these paths. Provide the
top-level generated filenames (e.g. `reference/index.md`, or per-module) in the
commit message / decision journal so T12 knows the exact slugs.

## Acceptance criteria

- Given `npm run docs:api`, then `docs-site/reference/` is populated with
  markdown covering the three entry points and their exported symbols; exit 0.
- Given `npm run docs:build`, then TypeDoc runs before VitePress and the full
  build exits 0 (verified in Batch 3 once pages exist; here, at minimum the
  `docs:api` step exits 0).
- Given `git status`, then no files under `docs-site/reference/` are tracked
  (gitignored).
- Given `git diff --name-only`, then only `package.json`, `typedoc.json`,
  `.gitignore` changed.

## Observability

N/A.

## Rollback

Reversible — revert; remove `typedoc.json` and the devDeps.

## Quality bar

`npm run typecheck && npm test && npm run build` still green (no src change).
`npm run docs:api` exits 0 and emits reference markdown.

## Boundaries

- **Always:** keep generated output gitignored; document only the public surface.
- **Never:** edit `docs-site/.vitepress/config.ts` (T12 owns it) or hand-edit
  generated reference markdown.
- **Ask first:** if `typedoc-plugin-markdown` output is incompatible with
  VitePress routing (e.g. clashing filenames), STOP and log options.

## Commit

`chore(T3): add TypeDoc markdown reference generation into docs:build`
Body: >3 files? no — but note the docs:build ordering change and the
gitignored `docs-site/reference/` output.
