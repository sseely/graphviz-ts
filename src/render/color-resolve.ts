// SPDX-License-Identifier: EPL-2.0
//
// Render-time color resolution, faithfully mirroring C's
// gvrender_resolve_color (lib/gvc/gvrender.c:188-213) for the SVG renderer.
//
// Every raw color string (a `color`/`fillcolor`/`pencolor`/`bgcolor` attribute,
// a gradient stop, a multicolor segment) is gated through the SVG renderer's
// `knowncolors` list (plugin/core/gvrender_core_svg.c:724-767):
//   - a name in the list is kept VERBATIM (C keeps `name` unchanged), so
//     `red`/`lightgrey`/`transparent` round-trip as written;
//   - any other spec (#hex, "H,S,V" HSV, "r,g,b[,a]", "/scheme/name") is run
//     through colorxlate() into canonical RGBA, which the SVG layer then emits
//     as lowercase `#rrggbb` (+ fill/stroke-opacity for partial alpha).
//
// This is the single chokepoint the render path was missing: the port had
// colorxlate() but never called it on the emission path, so colors were echoed
// verbatim (`#FF0000`, raw HSV `0.2,0.8,0.8`, unresolved scheme names).

import {
  colorxlate,
  getColorScheme,
  setColorScheme,
  type GVColor,
} from '../common/color.js';

/**
 * The SVG renderer's known color names, ported verbatim from
 * plugin/core/gvrender_core_svg.c:726-767 (svg_knowncolors[]). A name found
 * here is emitted as-is; anything else is canonicalized via colorxlate.
 *
 * Includes `transparent` (mapped to `none` at emission). Does NOT include
 * `none`, which is the literal output token, handled in resolveRenderColor.
 */
// prettier-ignore
const SVG_KNOWN_COLORS: readonly string[] = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure',
  'beige', 'bisque', 'black', 'blanchedalmond', 'blue',
  'blueviolet', 'brown', 'burlywood',
  'cadetblue', 'chartreuse', 'chocolate', 'coral',
  'cornflowerblue', 'cornsilk', 'crimson', 'cyan',
  'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray',
  'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred',
  'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray',
  'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue',
  'firebrick', 'floralwhite', 'forestgreen', 'fuchsia',
  'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray',
  'green', 'greenyellow', 'grey',
  'honeydew', 'hotpink', 'indianred',
  'indigo', 'ivory', 'khaki',
  'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon',
  'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
  'lightgray', 'lightgreen', 'lightgrey', 'lightpink',
  'lightsalmon', 'lightseagreen', 'lightskyblue',
  'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen',
  'magenta', 'maroon', 'mediumaquamarine', 'mediumblue',
  'mediumorchid', 'mediumpurple', 'mediumseagreen',
  'mediumslateblue', 'mediumspringgreen', 'mediumturquoise',
  'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin',
  'navajowhite', 'navy', 'oldlace',
  'olive', 'olivedrab', 'orange', 'orangered', 'orchid',
  'palegoldenrod', 'palegreen', 'paleturquoise',
  'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink',
  'plum', 'powderblue', 'purple',
  'red', 'rosybrown', 'royalblue',
  'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'silver', 'skyblue', 'slateblue', 'slategray',
  'slategrey', 'snow', 'springgreen', 'steelblue',
  'tan', 'teal', 'thistle', 'tomato', 'transparent', 'turquoise',
  'violet',
  'wheat', 'white', 'whitesmoke',
  'yellow', 'yellowgreen',
];

/** Lower-cased lookup set for the SVG known colors (case-insensitive, as C). */
export const KNOWN_COLORS: ReadonlySet<string> = new Set(SVG_KNOWN_COLORS);

/**
 * Resolve a raw color string to a canonical {@link GVColor} for rendering.
 *
 * @see lib/gvc/gvrender.c:188-213 gvrender_resolve_color
 */
export function resolveRenderColor(raw: string): GVColor {
  if (raw === '' || raw === 'none') return { type: 'none' };
  // C keeps a known name verbatim (case preserved); only the compare is
  // case-insensitive (bsearch over a lowercase table).
  if (KNOWN_COLORS.has(raw.toLowerCase())) return { type: 'string', s: raw };
  const color: GVColor = { type: 'rgba', r: 0, g: 0, b: 0, a: 0 };
  colorxlate(raw, color, 'rgba');
  return color;
}

/**
 * Run `fn` with the active color scheme set to `scheme`, restoring the previous
 * scheme afterwards (try/finally so it cannot leak across objects on throw).
 * Mirrors C's setColorScheme begin/end windows around each object's color block
 * (e.g. lib/common/emit.c:1781/1789 for nodes).
 */
export function withColorScheme<T>(scheme: string | undefined, fn: () => T): T {
  const prev = getColorScheme();
  setColorScheme(scheme ?? '');
  try {
    return fn();
  } finally {
    setColorScheme(prev);
  }
}

// ---------------------------------------------------------------------------
// SVG paint formatting (mirrors svg_print_paint / svg_grstyle opacity)
// ---------------------------------------------------------------------------

/** Lowercase `#rrggbb` from normalized [0,1] channels (round-to-byte). */
export function rgbaStr(r: number, g: number, b: number): string {
  const rh = Math.round(r * 255).toString(16).padStart(2, '0');
  const gh = Math.round(g * 255).toString(16).padStart(2, '0');
  const bh = Math.round(b * 255).toString(16).padStart(2, '0');
  return '#' + rh + gh + bh;
}

/**
 * Format a resolved color as an SVG paint string.
 * @see plugin/core/gvrender_core_svg.c:119-138 svg_print_paint
 */
export function colorPaint(color: GVColor): string {
  if (color.type === 'none') return 'none';
  if (color.type === 'string') {
    return color.s === 'transparent' ? 'none' : color.s;
  }
  if (color.type === 'rgba') {
    if (color.a === 0) return 'none';
    return rgbaStr(color.r, color.g, color.b);
  }
  return 'black';
}

/**
 * The `fill-opacity`/`stroke-opacity` value for a color, or null when none is
 * emitted (C emits it only for an RGBA_BYTE paint with alpha in (0,255)).
 * @see plugin/core/gvrender_core_svg.c:186-190, 207-210 ((float)rgba[3]/255.0)
 */
export function colorOpacity(color: GVColor): string | null {
  if (color.type !== 'rgba') return null;
  const byte = Math.round(color.a * 255);
  if (byte <= 0 || byte >= 255) return null;
  return (byte / 255).toFixed(6);
}

/**
 * The text-fill attribute string for a span's font color, mirroring the color
 * switch in svg_textspan (plugin/core/gvrender_core_svg.c:494-505). A known
 * name is emitted verbatim and SKIPPED when it is "black"; any other spec is
 * canonicalized to lowercase `#rrggbb` (always emitted, even if black) with
 * `fill-opacity` when alpha < 255. Returns '' when nothing is emitted.
 */
export function textFillAttrs(fontColor: string | null): string {
  if (fontColor === null) return '';
  const c = resolveRenderColor(fontColor);
  if (c.type === 'none') return '';
  if (c.type === 'string') {
    return c.s.toLowerCase() === 'black' ? '' : ' fill="' + c.s + '"';
  }
  if (c.type !== 'rgba') return '';
  let out = ' fill="' + rgbaStr(c.r, c.g, c.b) + '"';
  const byte = Math.round(c.a * 255);
  if (byte < 255) out += ' fill-opacity="' + (byte / 255).toFixed(6) + '"';
  return out;
}
