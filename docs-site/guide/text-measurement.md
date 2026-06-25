# Text measurement

Dot layout needs the width and height of every label to size nodes and place
edges. graphviz-ts measures text through a single pluggable seam, the
`TextMeasurer`, and resolves which one to use automatically — or you can set your
own.

## The contract

There are two distinct goals, and they call for different measurers:

| Goal | Measurer | Deterministic? | Kerning / shaping |
|------|----------|----------------|-------------------|
| **Reproducible layout** (same output everywhere) | built-in metric model | yes | no |
| **Host-faithful layout** (matches the rendering font) | the platform's canvas | no (font-dependent) | yes |

Native graphviz itself is host-faithful — its output depends on the fonts
installed on the machine that runs it. graphviz-ts lets you choose: deterministic
by default, host-faithful when you opt in.

## Automatic resolution

When you don't set a measurer, graphviz-ts picks one per render:

1. an explicit measurer set via `setTextMeasurer` (wins if present);
2. **browser** (`document` available) → the page's `<canvas>` — host-faithful,
   measuring with the same font the browser will render the SVG text with;
3. **Node** → the built-in deterministic metric model.

The library has **zero runtime dependencies** and never imports a font library or
`canvas` itself, so the browser bundle stays small and the Node default never
reads the filesystem.

## Host-faithful measurement in Node

For Node output whose boxes fit a specific font (real kerning and shaping),
install the optional `canvas` peer and wire it once at startup:

```ts
import { setTextMeasurer, CanvasTextMeasurer, renderSvg } from 'graphviz-ts';
import { createCanvas } from 'canvas'; // optional peer dependency: `npm i canvas`

setTextMeasurer(new CanvasTextMeasurer(createCanvas(0, 0).getContext('2d')));

const svg = renderSvg('digraph { A -> B }', 'dot');
```

`canvas` is declared as an **optional peer dependency** — it is not installed
unless you ask for it. When Node falls back to the built-in model in an
interactive terminal, graphviz-ts prints this advice once; silence it with
`GV_FONT_QUIET=1`.

## Custom measurers

`setTextMeasurer` accepts anything implementing `TextMeasurer`:

```ts
import { setTextMeasurer, type TextMeasurer } from 'graphviz-ts';

const myMeasurer: TextMeasurer = {
  measure: (text, fontname, fontsize) => ({ w: text.length * fontsize * 0.6, h: fontsize }),
};
setTextMeasurer(myMeasurer);
setTextMeasurer(undefined); // restore automatic resolution
```

Built-in implementations are exported for reuse: `CanvasTextMeasurer` (wrap any
2D context), `EstimateTextMeasurer` (the deterministic, un-hinted reference that
matches headless graphviz), and `LutTextMeasurer` (the hinted built-in default).

## Why this split

Kerning, ligatures and non-ASCII glyph widths depend on the actual font's shaping
tables — a per-character width table cannot represent them, and the right values
differ per font (a monospace font renders `<=` as two cells; a proportional font
kerns `VA` closer). Reproducible layout therefore uses a fixed metric model;
matching a real rendering font requires measuring with that font, which is what
the canvas-backed measurer does.
