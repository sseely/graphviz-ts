<!-- SPDX-License-Identifier: EPL-2.0 -->
# T11 — Expand API reference (`docs-site/guide/api.md`)

## Context

`docs-site/guide/api.md` (127 lines) is a thin flat reference. In the new IA it
becomes the **curated, hand-written** API overview that orients readers and
hands off to the exhaustive TypeDoc `/reference` for full signatures. It must
document the T1 image API and cross-link the new pages.

**Depends on T1** — document `setImageResolver` + `RenderOptions.inlineImages`
as shipped.

## Task

Rework `docs-site/guide/api.md`:

1. **Keep the existing intro** about the small surface and shipped `.d.ts` /
   source maps.
2. **Organize by entry point** (matching the overview's "three doors"):
   - `graphviz-ts` (root): `renderSvg`, `tryRenderSvg`/`RenderResult`, `parse`/
     `ParseError`, `RenderError`, `setTextMeasurer`/`getTextMeasurer`,
     `setImageSizer`, **`setImageResolver`** (T1), `GvcContext`/`renderWithContext`.
   - `graphviz-ts/api`: `createGraph`, `addEdge`, `getLayout`, and the `Graph`
     opaque handle.
   - `graphviz-ts/render`: `render` (+ `OutputFormat`, `RenderOptions` incl.
     **`inlineImages`**), `getDrawOps`/`DEFAULT_DRAW_ENGINE`.
   For each function: signature, one-paragraph description, params, throws,
   and a one-line link to its full TypeDoc reference entry.
3. **Add a `setImageResolver` / `inlineImages` section** with a runnable
   snippet (mirror the images guide, but reference-terse). Cross-link
   `/guide/images`.
4. **Cross-link heavily** at the top: "See the [Overview](/guide/overview) for
   which entry point to use, [Types](/guide/types) for data shapes, and the
   generated [Reference](/reference/) for exhaustive signatures."
5. **Preserve** the existing `setImageSizer` doc; place it beside
   `setImageResolver` and note the difference (sizer = dimensions for layout;
   resolver = bytes for inlining).

Do not turn this into the full generated reference — it's the *curated* layer.

## Read-set

- `docs-site/guide/api.md` (current — the file being modified)
- `src/index.ts` (root exports — exact names/signatures)
- `src/render/public.ts` (`render`, `RenderOptions` incl. T1's `inlineImages`)
- `src/api/index.ts`, `src/api/builder.ts`, `src/api/geometry.ts`
- T1's `src/gvc/image-resolver.ts` (the resolver API as shipped)
- `docs-site/guide/images.md` (T7 — keep consistent; this is the terse mirror)

## Interface inputs (from T1)

`setImageResolver`, `ImageResolver`, `RenderOptions.inlineImages`.

## Acceptance criteria

- Given the page, then functions are grouped by the three entry points, each
  with signature + description + a link to its TypeDoc reference entry.
- Given the image section, then both `setImageSizer` and `setImageResolver` are
  documented with the sizer-vs-resolver distinction and an `inlineImages`
  snippet.
- Given the top of the page, then it cross-links overview, types, and the
  generated reference.
- Given `npm run docs:build`, then the page builds and links resolve.

## Observability / Rollback

N/A / Reversible.

## Quality bar

`npm run docs:build` green. Signatures match source exactly (verify against
`src`, not this brief). No `src` changes.

## Boundaries

- **Always:** keep this the curated layer; defer exhaustive field lists to
  `/reference`.
- **Never:** invent signatures — copy from source; never duplicate the full
  generated reference.
- **Ask first:** if T1's shipped API differs from the decision — document what
  shipped.

## Commit

`docs(T11): expand the curated API reference and document the image API`
