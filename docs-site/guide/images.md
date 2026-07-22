# Images

A node with `image="logo.png"` (or an HTML-like label's `<IMG SRC="logo.png">`
cell) does not get its pixels embedded by default. graphviz-ts emits the
source **verbatim**:

```html
<image xlink:href="logo.png" width="64px" height="64px" .../>
```

Whatever displays the SVG — a browser `<img>`/inline `<svg>`, an Electron
shell, a static-site build — resolves that `href` itself. This page covers
how that href gets sized during layout, three ways to make the pixels actually
show up, and the CSP implications of each.

## How images flow

1. The graph declares `image="logo.png"` on a node, or an HTML-like label
   contains an `<IMG>` cell.
2. Graphviz needs the image's **intrinsic width/height** to size the node box
   before it can lay out anything else — the library never touches the
   filesystem or the network to find this out, so you register a sizer
   (`setImageSizer`, covered in [Browser usage](/guide/browser) and again
   below for Node).
3. Layout runs using the dimensions your sizer returned.
4. The SVG emitter (`src/render/svg.ts`'s `usershape()`) writes
   `<image xlink:href="...">` with the box computed in step 3. By default the
   `href` is the raw `src` string, XML-escaped, nothing else.
5. Optionally — if you called `setImageResolver` and rendered with
   `{ inlineImages: true }` — the emitter instead writes
   `xlink:href="data:<mime>;base64,<bytes>"`, a self-contained `data:` URI.
   This is additive; it is not something native Graphviz does.

Sizing and inlining are two independent, separately-registered seams: you can
size images without inlining them (the common case — host the file), or do
both (self-contained SVG).

## Sizing in Node vs. browser

`setImageSizer` takes `(src: string) => { w: number; h: number } | null` and
is consulted once per distinct `image=`/`<IMG>` source during layout. It is a
process-global registration, same pattern as `setImageResolver` below — call
it once before `render()`/`renderSvg()`.

**Browser** — measure the real image, since you already have `Image` and
`decode()`:

```ts
import { setImageSizer } from 'graphviz-ts';

const cache = new Map<string, { w: number; h: number }>();

async function warmImageSizes(sources: string[]): Promise<void> {
  for (const src of sources) {
    const img = new Image();
    img.src = src;
    await img.decode();
    cache.set(src, { w: img.naturalWidth, h: img.naturalHeight });
  }
}

// setImageSizer itself must be synchronous, so pre-warm the cache first
// (e.g. await warmImageSizes([...]) before calling render/renderSvg).
setImageSizer((src) => cache.get(src) ?? null);
```

`setImageSizer` is a synchronous callback — there is no `await` inside it —
so the browser path pre-resolves dimensions (via `decode()`) into a cache
before layout runs, then reads that cache synchronously.

**Node** — there is no DOM `Image`, and the library will not read the
filesystem for you. Either hardcode known dimensions, or read them yourself
(e.g. from a manifest, or a lightweight PNG/JPEG header parser you supply) and
feed the result the same way:

```ts
import { setImageSizer } from 'graphviz-ts';
import { readFileSync } from 'node:fs';

// Simplest: fixed dimensions known ahead of time.
setImageSizer((src) => (src === 'logo.png' ? { w: 64, h: 64 } : null));

// Or: derive dimensions in your app layer (disk, S3 head request, a
// manifest file you maintain) and hand back the result synchronously.
const manifest = new Map(
  Object.entries(JSON.parse(readFileSync('image-manifest.json', 'utf8'))),
);
setImageSizer((src) => (manifest.get(src) as { w: number; h: number }) ?? null);
```

If your graphs never reference external images, skip this entirely.

## Making the image appear

Sizing gets layout right; it does not make the pixels show up wherever the
SVG ends up displayed. Pick one of three approaches.

### 1. Host the file

Serve the image at a URL (or a path relative to wherever the SVG is
displayed) the browser/consumer can fetch. This is the simplest option and
requires no extra render-time work — but the display context must be able to
reach that origin, and if the SVG is shown somewhere with a strict `img-src`
CSP, that origin must be allow-listed there too (see below).

### 2. Inline as a `data:` URI

Use T1's inlining API to produce one self-contained SVG string with no
external fetch at all: `setImageResolver` supplies raw bytes, and
`render(g, 'svg', { inlineImages: true })` embeds them.

```ts
import { render, setImageResolver } from 'graphviz-ts';
import type { ImageResolver } from 'graphviz-ts';

const images = new Map<string, Uint8Array>([
  ['logo.png', /* Uint8Array of the PNG bytes, e.g. fetched or bundled */ new Uint8Array()],
]);

const resolver: ImageResolver = (src) => images.get(src) ?? null;

setImageResolver(resolver);

const svg = render(g, 'svg', { inlineImages: true });
```

`ImageResolver` may also return `{ bytes: Uint8Array; mime?: string }` when
you want to specify a MIME type explicitly (the emitter otherwise infers one
from the source's file extension — `.png` → `image/png`, `.svg` →
`image/svg+xml`, and so on, falling back to `application/octet-stream` for
unknown extensions). Set `setImageResolver(null)` to clear the registration.

::: tip
Prefer inlining when the SVG travels somewhere that cannot fetch external
resources at display time — email clients, offline docs, a strict-CSP embed,
or anywhere you want one self-contained string with no follow-up network
request. The trade-off is output size: base64 inflates the image ~33%, and
it's duplicated into every SVG that references it (no browser cache reuse
across renders).
:::

`inlineImages` defaults to `false`; unset, output is byte-identical to the
pre-inlining passthrough. It only affects the `svg` format — it has no effect
on `json`/`xdot`/`dot`/other text formats. A miss (no resolver registered, or
the resolver returns `null` for that `src`) falls back to the raw `src`
passthrough automatically — inlining degrades gracefully, it never throws.

### 3. `imagepath`-style base directories

Native Graphviz's `imagepath` graph attribute tells the C binary a
filesystem/`GDFONTPATH`-style search directory to resolve relative `image=`
values against. graphviz-ts does not implement `imagepath` — the port never
reads image data from disk itself, so there is no path to resolve against
(see [Known divergences](/divergences) for the full scope boundary). If your
graphs use relative `image=` paths, resolve them against your own base
directory/URL in whichever layer constructs the DOT source or in your
`setImageSizer`/`ImageResolver` callbacks — both receive the raw `src` string
exactly as written in the graph, so string-prefixing it with a base path
before lookup is a normal, sanctioned pattern.

## CSP guidance

If your graphs are user-supplied (a playground, an embed that renders
arbitrary DOT), think about the page's `img-src` policy up front.

**Inlined images (`data:` URIs)** need only:

```
img-src 'self' data:
```

As an HTTP response header:

```
Content-Security-Policy: img-src 'self' data:
```

Or as a meta tag in the page that hosts the SVG:

```html
<meta http-equiv="Content-Security-Policy" content="img-src 'self' data:">
```

That's tight — no external image host is ever contacted, because the bytes
are already embedded in the SVG string.

**Hosted images (option 1 above)**, by contrast, need the display context to
fetch from wherever those images actually live. If a user-supplied graph can
reference an arbitrary `image=` URL, allow-listing every possible host is
often impractical, so a playground/embed page may need something permissive:

```
Content-Security-Policy: img-src 'self' data: https:
```

::: warning
Never make `img-src *` (or any equally permissive `img-src`) your **site-wide**
default. Scope it to the specific playground/embed page that needs to render
arbitrary user-supplied graphs, treat it as a deliberate, documented
relaxation for that page only, and keep every other page's CSP tight. A
permissive `img-src` lets a malicious graph exfiltrate data via image-URL
side channels (e.g. encoding data in query parameters against an
attacker-controlled host) or load undesirable remote content. If you control
the image set, prefer inlining (`data:`) instead and keep `img-src 'self'
data:` everywhere.
:::

## Missing images

If `setImageSizer` returns `null` (or no sizer is registered) for a
referenced source, graphviz-ts follows the same C-faithful path as native
Graphviz's `gvusershape` miss: it warns and treats the image as **zero
size**, which affects the node box layout computed around it. If
`setImageResolver`/`inlineImages` is in play and the resolver misses, the
emitter falls back to the raw `src` passthrough rather than inlining — the
`href` still gets written, it just won't resolve unless something else on the
page can fetch it. See [Known divergences](/divergences) for what's in and
out of scope for image/raster handling generally.
