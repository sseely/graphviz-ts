<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Content pages

Seven documentation tasks. Each owns exactly one (or two, T9) **new or
modified** markdown file — write-sets are disjoint, so run in parallel. T7 and
T11 consume T1's API surface (Batch 1); the rest depend on nothing. None edits
`.vitepress/config.ts` — T12 (Batch 3) wires the sidebar so these pages need
not coordinate on navigation.

House style: match the existing `docs-site/guide/*.md` — concise, front-loaded,
runnable `ts`/`dot` fenced code, `:::tip`/`:::warning` VitePress containers,
mermaid for relationships. Every page must cross-link related pages by their
site path (e.g. `/guide/types`, `/guide/recipes`). Front-load: the first ~15
lines say what the page is and who it's for.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T5 | Types reference (shapes + mermaid relationships) | technical-writer (Sonnet) | `docs-site/guide/types.md` | — | [ ] |
| T6 | Recipes cookbook harvested from plantuml-ts | technical-writer (Sonnet) | `docs-site/guide/recipes.md` | — | [ ] |
| T7 | Images guide (resolver/sizer, deploy, CSP) | technical-writer (Sonnet) | `docs-site/guide/images.md` | T1 | [ ] |
| T8 | Conceptual overview / mental model | technical-writer (Sonnet) | `docs-site/guide/overview.md` | — | [ ] |
| T9 | Migration pages (from C CLI; from JS libs) | technical-writer (Sonnet) | `docs-site/guide/migrate-from-c-cli.md`, `migrate-from-js-libs.md` | — | [ ] |
| T10 | Glossary | technical-writer (Sonnet) | `docs-site/guide/glossary.md` | — | [ ] |
| T11 | Expand API reference prose + document image API | technical-writer (Sonnet) | `docs-site/guide/api.md` | T1 | [ ] |

## Gate after batch

`npm run docs:build` must succeed (all new pages parse; links that point at
in-repo pages resolve). Broken relative links to pages that exist are a fail;
links to `/guide/*` slugs the batch created are expected to resolve once T12
adds them to the sidebar, but the pages themselves already exist so VitePress
will build. Also `npm run typecheck && npm test` (unchanged, should stay green).
