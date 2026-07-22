<!-- SPDX-License-Identifier: EPL-2.0 -->
# T12 — IA overhaul: sidebar, landing, getting-started

## Context

Batches 1–2 created the new pages (overview, types, recipes, images, migration,
glossary, expanded api) and the generated TypeDoc reference. This task is the
**single owner** of the navigation and landing surface, tying it into a
React/Angular-style IA: a clear Guide / Recipes / Reference split, a landing
that orients, and a getting-started that points into the mental model.

## Task

### 1. `docs-site/.vitepress/config.ts` — sidebar + nav restructure

Restructure `themeConfig.sidebar` into grouped sections (order suggested):

- **Introduction**: Overview (`/guide/overview`), Getting started, Layout
  engines, Glossary (`/guide/glossary`).
- **Guides**: Browser usage, Build a graph in code, Read computed geometry,
  Text measurement, Working with images (`/guide/images`), Render to other
  formats, Custom rendering with xdot.
- **Recipes**: Recipes cookbook (`/guide/recipes`).
- **Migrating**: From the C CLI (`/guide/migrate-from-c-cli`), From JS libraries
  (`/guide/migrate-from-js-libs`).
- **Reference**: API reference (curated, `/guide/api`), Types (`/guide/types`),
  Generated API (TypeDoc — link the top-level slug T3 produced under
  `/reference/`), Playground, Conformance, Known divergences, Parity dashboard,
  Engine parity, Performance.

Update `nav` to add an **Overview** entry and keep Playground/API/Conformance/
Parity. Use the exact generated-reference slug from T3's commit note / decision
journal (e.g. `/reference/` or `/reference/index`). If TypeDoc's index slug is
uncertain, verify by running `npm run docs:api` and listing `docs-site/reference/`.

### 2. `docs-site/index.md` — landing redesign

- Enrich the hero features (keep the three existing; consider adding a fourth on
  "Programmatic layout + geometry" via `getLayout`).
- After the inline playground, add a **"Choose your path"** section: card-style
  links (VitePress `:::info`/custom containers or a simple table) to Overview,
  Getting started, Recipes, API reference, Playground — the React-docs landing
  pattern. Keep it concise and on-brand with the existing hero copy.
- Add a one-line link to the generated Reference and to Images/CSP for embedders.

### 3. `docs-site/guide/getting-started.md` — orientation

- Add a short **"Mental model"** callout near the top linking `/guide/overview`
  (the three entry points), so first-time readers get the map.
- Add a "Next steps" list at the end linking recipes, geometry, images, types,
  api. Keep the existing install/quickstart intact.

## Read-set

- `docs-site/.vitepress/config.ts` (current sidebar/nav — the file to rewrite)
- `docs-site/index.md` (current landing)
- `docs-site/guide/getting-started.md` (current)
- The pages created in Batch 2 (confirm their exact slugs/titles before linking)
- T3's decision-journal note / commit for the generated reference slug; and
  `docs-site/reference/` listing after `npm run docs:api`

## Dependencies

- **T3** — generated reference path must exist to link it.
- **T5–T11** — page slugs must exist so sidebar links resolve.

## Acceptance criteria

- Given the built site, then the sidebar shows the grouped sections
  (Introduction / Guides / Recipes / Migrating / Reference) and every link
  resolves (no 404 in `npm run docs:build`).
- Given the landing, then it has a "choose your path" section linking the key
  pages, and the generated Reference is reachable from nav/sidebar.
- Given getting-started, then it links the Overview mental-model page near the
  top and has a Next-steps list.
- Given `npm run docs:build`, then it exits 0 (VitePress + copy-reports +
  TypeDoc), with no dead internal links.
- Given `git diff --name-only`, then only the three files above changed.

## Observability / Rollback

N/A / Reversible.

## Quality bar

Full final gates (README "Final quality gates"): `typecheck`, `test`, `build`,
`docs:build` all green; the `/Users/` grep on `docs-site/parity-*.md` is clean;
built nav renders the groups and resolves the Reference section.

## Boundaries

- **Always:** verify every sidebar/nav link against an existing page/slug before
  committing; use the real generated-reference slug.
- **Never:** create new content pages here (that was Batch 2) or edit pages
  another task owns.
- **Ask first:** if a linked page slug doesn't exist (a Batch-2 task didn't land
  its file), STOP — do not link a 404.

## Commit

`docs(T12): restructure docs IA, redesign landing, orient getting-started`
Body: describe the Guide/Recipes/Migrating/Reference grouping and the generated
reference wiring.
