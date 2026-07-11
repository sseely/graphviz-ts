# Browser usage

graphviz-ts uses no Node-only APIs and is safe to bundle for the browser. This
page covers the two things to know when running client-side.

## Bundling

The library is plain ES modules. Any modern bundler (Vite, esbuild, Rollup,
webpack) can include it. There are no runtime dependencies to externalize and no
WASM artifacts to host.

```ts
import { renderSvg } from 'graphviz-ts';

const svg = renderSvg('digraph { a -> b }', 'dot');
document.querySelector('#out')!.innerHTML = svg;
```

This very site's [playground](/playground) does exactly that — it imports the
engine and calls `renderSvg` in the browser, with no server round-trip.

## Text measurement

Graphviz needs text dimensions to size labels. graphviz-ts handles this
automatically:

- **In the browser** (when `document` exists), it measures text with the
  native `<canvas>` 2D context — host-faithful, since it's the same font the
  browser renders the SVG with.
- **In Node**, it defaults to the built-in **Estimate** measurer — a
  deterministic, headless-safe model that mirrors Graphviz's own
  `estimate_textspan_size`. No `canvas` install or font files are required to
  get correct layout in Node; a hinted lookup-table (LUT) measurer is also
  available as an opt-in for closer host-faithful sizing without a native
  canvas dependency. See [Text measurement](/guide/text-measurement) for how
  to select a measurer explicitly.

No font files are required for layout in any case.

## External images: `setImageSizer`

When a graph references an external image (e.g. `node [image="logo.png"]`),
Graphviz needs that image's intrinsic dimensions. Because the library cannot
read the filesystem, you supply a sizer:

```ts
import { setImageSizer } from 'graphviz-ts';

setImageSizer((src) => {
  // Return the intrinsic { w, h } for this image source, or null if unknown.
  return { w: 64, h: 64 };
});
```

If your graphs never reference external images, you do not need to call this.

## What not to expect

The library targets **SVG** (plus `json` / `xdot` / `dot` / imagemap text
formats). Raster output (PNG/JPG), PostScript/PDF, and interactive/GUI backends
are out of scope — convert the SVG downstream if you need another format. See
[Known divergences](/divergences) for the full scope boundary.
