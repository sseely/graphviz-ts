<!-- SPDX-License-Identifier: EPL-2.0 -->
# T7 — Images guide (`docs-site/guide/images.md`)

## Context

Two things about images are currently under-documented: (a) how an external
image referenced by a graph actually ends up in the output, and (b) how to make
those images *appear* wherever the SVG is displayed. graphviz-ts emits
`<image xlink:href="src">` referencing the source **verbatim** (it does not
embed by default). T1 adds `setImageResolver` + `render({ inlineImages: true })`
to inline images as `data:` URIs. This guide ties it together and gives
deployment + CSP guidance.

**Depends on T1** — document the API exactly as T1 shipped it (read T1's
`image-resolver.ts` and the `RenderOptions.inlineImages` doc).

## Task

Write `docs-site/guide/images.md`:

1. **How images flow** — a node `image="logo.png"` (or HTML `<IMG>`) becomes
   `<image xlink:href="logo.png">`. The href is passed through verbatim; the
   browser/consumer resolves it. Graphviz needs the image's intrinsic size for
   layout → `setImageSizer` (link `/guide/browser`). Include a small mermaid or
   ordered list of the flow.
2. **Sizing in Node vs browser** —
   - Browser: measure via `new Image()` + `.decode()` / `naturalWidth`.
   - Node: supply known dimensions, or read them from the file/headers in your
     app layer (the library never touches the filesystem). Show a `setImageSizer`
     snippet for each.
3. **Making the image appear** — three deployment options, with trade-offs:
   - **Host the file** and use a URL/relative path the display context can
     fetch (simplest; requires the asset be served with a compatible origin).
   - **`data:` URI inline** via T1: `setImageResolver` + `inlineImages:true` →
     self-contained SVG (no external fetch; larger output; great for email,
     offline docs, strict CSP). Full runnable snippet.
   - **`imagepath`/base directory** conventions — how graph-side `image=` paths
     are interpreted; keep to what the port supports.
4. **CSP guidance** — for pages that render user-supplied graphs (a playground
   or an embed):
   - If images are inlined as `data:` URIs, allow `img-src 'self' data:`.
   - If images load from arbitrary external hosts (host-the-file path), a
     permissive `img-src` (e.g. `img-src *` or an explicit allow-list) is
     needed on **playground/embed** pages — call this out as a deliberate,
     page-scoped relaxation, not a site-wide default. Explain the trade-off
     (arbitrary remote fetch) and recommend inlining (`data:`) when you want a
     tight CSP. Give an example `<meta http-equiv="Content-Security-Policy">`
     and an HTTP-header form.
5. **Missing images** — behavior when the sizer/resolver returns `null`
   (C-faithful: warning + zero size / raw href). Link `/divergences` for the
   raster-output scope boundary.

Use `:::warning` for the CSP `img-src *` caveat and `:::tip` for the inline
recommendation.

## Read-set

- T1's `src/gvc/image-resolver.ts` (API as shipped — types, `toDataUri`)
- T1's `RenderOptions.inlineImages` doc in `src/render/public.ts`
- `src/gvc/usershape.ts`, `src/render/svg.ts:262-280` (the emit семantics)
- `docs-site/guide/browser.md:40-70` (existing `setImageSizer` section — extend/
  link, don't duplicate wholesale)
- `docs-site/playground.md` (the CSP guidance targets pages like this)
- [decisions.md#image-api](../decisions.md#image-api)

## Interface inputs (from T1)

`setImageResolver`, `ImageResolver`, `RenderOptions.inlineImages`.

## Acceptance criteria

- Given the page, then it documents the verbatim-href default AND the
  `inlineImages` data-URI path with a runnable snippet using T1's real API.
- Given the CSP section, then it recommends `img-src 'self' data:` for inlined
  images and explains when a permissive `img-src` is needed for external-host
  images, scoped to playground/embed pages, with a concrete example.
- Given the Node vs browser section, then both sizer strategies have snippets.
- Given `npm run docs:build`, then the page builds and links resolve.

## Observability / Rollback

N/A / Reversible.

## Quality bar

`npm run docs:build` green. Snippets match T1's shipped signatures exactly
(verify against source, not this brief).

## Boundaries

- **Always:** describe the API as T1 actually shipped it; scope the permissive
  CSP advice to playground/embed pages.
- **Never:** recommend a site-wide `img-src *`; never claim the library reads
  files.
- **Ask first:** if T1's final API differs from [decisions.md#image-api] —
  document what shipped and note the delta.

## Commit

`docs(T7): add images guide with inlining, deployment, and CSP guidance`
